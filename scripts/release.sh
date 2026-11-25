#!/usr/bin/env bash
# [BUMP=patch|minor|major] [VERSION=x.y.z] STORY=n release.sh (all optional) - ship a version and prove it, as one command. The session runs it; it commits
# the version bump, merges into main and pushes a tag, and running it is the owner's yes. VERSION defaults to the latest
# published version + 1. Local first: the tests, the Release workflow's tests (act) and the image build run on this
# machine before anything is pushed. Then it merges develop into main once green, tags vVERSION, waits for the owner's one
# approval and the publish, installs the release from every channel in clean containers, and keeps that proof in tmp/
# (never posted: proof output can carry customer or tenant names). STORY only tags the version commit.
# Used by `task release`.
set -euo pipefail
R=nnthanh101/1xops
cd "$(git rev-parse --show-toplevel)"
git fetch -q origin --tags
# Latest = the highest of the latest published version and the latest tag (a tag can exist before its publish).
pub=$(npm view 1xops version 2>/dev/null || echo 0.0.0)
tag=$(git tag --list 'v*' --sort=-v:refname | head -1); tag=${tag#v}
last=$(printf '%s\n%s\n' "$pub" "${tag:-0.0.0}" | sort -V | tail -1)
# Next version = latest + 1, by SemVer: BUMP=patch (default: fixes, UX), minor (a new command or
# capability), major (a breaking change to commands, files or settings).
V=${VERSION:-$(echo "$last" | awk -F. -v b="${BUMP:-patch}" '{ if (b=="major") print $1+1".0.0"; else if (b=="minor") print $1"."$2+1".0"; else print $1"."$2"."$3+1 }')}
STORY=${STORY:-}
[[ "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "release: VERSION must be x.y.z, not '$V'"; exit 1; }
[ "$V" != "$pub" ] && [ "$(printf '%s\n%s\n' "$pub" "$V" | sort -V | tail -1)" = "$V" ] \
  || { echo "release: v$V is not newer than the published v$pub"; exit 1; }
[ "$(git branch --show-current)" = develop ] || { echo "release: run it on develop"; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "release: commit or stash your changes first"; exit 1; }
[ "$(git rev-parse origin/develop)" = "$(git rev-parse HEAD)" ] || { echo "release: this clone is not at origin/develop; pull or push first"; exit 1; }
echo "release: v$V (latest released: v${last:-none})"

mkdir -p tmp
echo "release: local first - task gate (lint, tests, act, image, every command as a customer sees it)"
# three runs per eval case: one run can flip a case either way, and this score goes into the release question
RUNS=${RUNS:-3} task gate >tmp/gate-release.log 2>&1 || { echo "release: task gate fails; see tmp/gate-release.log"; exit 1; }
[ -f tmp/evals/latest/summary.txt ] && { echo "release: eval cases (advice):"; tail -1 tmp/evals/latest/summary.txt; }

py=$(grep -E '^version = ' packages/python/pyproject.toml | cut -d'"' -f2)
js=$(node -p "require('./packages/npm/package.json').version")
pl=$(node -p "require('./plugins/1xops/.claude-plugin/plugin.json').version")
if [ "$py" != "$V" ] || [ "$js" != "$V" ] || [ "$pl" != "$V" ]; then
  sed -i.bak -E "s/^version = \"[^\"]+\"/version = \"$V\"/" packages/python/pyproject.toml && rm packages/python/pyproject.toml.bak
  # only the version line changes; npm pkg set would reflow the whole file
  node -e 'const f=process.argv[1],fs=require("fs");fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace(/"version": "[^"]+"/,`"version": "${process.argv[2]}"`))' packages/npm/package.json "$V"
  # the plugin version too: Claude Code updates an installed plugin only when this number changes
  node -e 'const f=process.argv[1],fs=require("fs");fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace(/"version": "[^"]+"/,`"version": "${process.argv[2]}"`))' plugins/1xops/.claude-plugin/plugin.json "$V"
  uv lock --project packages/python -q
  git --no-pager diff --stat
  echo "release: version $py -> $V, committed and pushed to develop"
  git commit -q -m "chore: release v$V${STORY:+ (Refs #$STORY)}" packages/python/pyproject.toml packages/python/uv.lock packages/npm/package.json plugins/1xops/.claude-plugin/plugin.json
  git push -q origin develop
fi

pr=$(gh pr list -R $R --base main --head develop --state open --json number --jq '.[0].number // empty')
[ -n "$pr" ] || pr=$(gh pr create -R $R --base main --head develop --title "release: v$V" --body "Release v$V" | grep -oE '[0-9]+$')
echo "release: pull request #$pr; waiting for its checks"
for _ in $(seq 30); do # a new commit's checks take a moment to register; --watch fails while there are none
  [ "$(gh pr view "$pr" -R $R --json statusCheckRollup --jq '.statusCheckRollup | length')" -gt 0 ] && break
  sleep 2
done
# A GitHub API error (it happened on 25 Nov 2026) ends --watch like a failure. Retry the wait up to 3 times; stop at
# once only when a check really failed.
for attempt in 1 2 3; do
  gh pr checks "$pr" -R $R --watch --fail-fast && break
  failed=$(gh pr checks "$pr" -R $R --json bucket --jq '[.[] | select(.bucket=="fail")] | length' 2>/dev/null || echo "")
  [ "$failed" = 0 ] || { echo "release: a check failed on pull request #$pr; see gh pr checks $pr"; exit 1; }
  [ "$attempt" = 3 ] && { echo "release: GitHub did not answer about the checks of #$pr; run task release again"; exit 1; }
  echo "release: GitHub did not answer; waiting 30 s and watching the checks again ($attempt of 3)"; sleep 30
done
gh pr merge "$pr" -R $R --merge
git fetch -q origin
# A rerun after a later step failed keeps the tag it already made on main.
git rev-parse -q --verify "refs/tags/v$V" >/dev/null || git tag "v$V" origin/main
git push -q origin "v$V"

# The run for this tag on this commit. Never by tag name alone: a reused tag name matches an old run of another commit,
# and GitHub sometimes starts no run for a tag push, so after 30 seconds start one on the tag (a dispatch runs the same checks).
sha=$(git rev-parse "v$V^{commit}")
runs_for_tag() { gh run list -R $R -w release.yml -L 40 --json databaseId,headSha,headBranch,status \
  --jq "[.[] | select(.headSha==\"$sha\" and .headBranch==\"v$V\")]"; }
run=""
for i in $(seq 60); do
  run=$(runs_for_tag | jq -r '.[0].databaseId // empty')
  [ -n "$run" ] && break
  if [ "$i" = 15 ]; then
    echo "release: GitHub started no Release run for the tag push; starting one on v$V"
    gh workflow run release.yml -R $R --ref "v$V"
  fi
  sleep 2
done
[ -n "$run" ] || { echo "release: no Release run for v$V on $sha; see https://github.com/$R/actions"; exit 1; }
echo "release: approve the 'release' environment once: https://github.com/$R/actions/runs/$run"
gh run watch "$run" -R $R --exit-status >/dev/null || { echo "release: the Release run failed; see the link above"; exit 1; }
# A late tag-push run can appear next to the one that published: it must never be approved. Name it; the owner cancels it.
runs_for_tag | jq -r --arg run "$run" '.[] | select((.databaseId|tostring) != $run and .status != "completed")
  | "release: run \(.databaseId) is a duplicate for this tag and waits for approval: do not approve it; cancel it with gh run cancel \(.databaseId) -R '"$R"'"'

# The registries need a moment to serve a new version everywhere. Prove only once the files a customer's install
# fetches answer: PyPI's simple index (what uv and pip read) and the npm tarball. Their JSON APIs answer first (up to 5 min).
served=""
for _ in $(seq 30); do
  curl -sf -H 'Accept: application/vnd.pypi.simple.v1+json' https://pypi.org/simple/1xops/ | grep -q "\"$V\"" \
    && curl -sfI "https://registry.npmjs.org/1xops/-/1xops-$V.tgz" >/dev/null && served=1 && break
  sleep 10
done
[ -n "$served" ] || echo "release: PyPI or npm does not serve v$V after 5 minutes; proving anyway (a lagging channel retries)"
proof=tmp/evidence-$V.md
set +e; bash scripts/verify-release.sh "$V" | tee "$proof"; failed=${PIPESTATUS[0]}; set -e
[ "$failed" -eq 0 ] || { echo "release: v$V is published but $failed check(s) failed; the story stays open"; exit 1; }
# then as a new member: install the release fresh and build and copy a plugin from synthetic inputs (MEMBER_PROOF=0 skips)
if [ "${MEMBER_PROOF:-1}" != 0 ]; then
  bash scripts/member-proof.sh "$V" || { echo "release: v$V is published; the member proof failed (tmp/member-proof-$V/summary.txt); the story stays open"; exit 1; }
fi
echo "release: v$V shipped and proven; proof in $proof (local, not posted)"
