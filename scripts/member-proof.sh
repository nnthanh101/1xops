#!/usr/bin/env bash
# member-proof.sh [VERSION] - prove a published release the way a new member meets it, after verify-release.sh proved
# the registries. A fresh settings folder installs 1xops vVERSION from GitHub (with its 12 library plugins); a fresh
# clone of the tag gets synthetic inputs (tests/member-proof); then discover, plugin copy, plugin make and
# check setup runs headless with only those installed plugins and no user or project settings, and the release
# check is tried with a listed link and a listed copy. Model runs on your sign-in (they cost money). Evidence stays in
# tmp/member-proof-VERSION/ (never posted). Exit 0 only when every case passed its file check.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
V=${1:-$(git tag --list 'v*' --sort=-v:refname | head -1 | sed 's/^v//')}
root=$(pwd); E=$root/tmp/member-proof-$V; W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
rm -rf "$E"; mkdir -p "$E"; fails=0
export CLAUDE_CONFIG_DIR=$W/config; mkdir -p "$CLAUDE_CONFIG_DIR"
{ claude plugin marketplace add anthropics/knowledge-work-plugins
  claude plugin marketplace add "nnthanh101/1xops#v$V"
  claude plugin install 1xops@1ops; } >"$E/install.txt" 2>&1
got=$(jq -r '.plugins["1xops@1ops"][0].version // empty' "$CLAUDE_CONFIG_DIR/plugins/installed_plugins.json" 2>/dev/null)
[ "$got" = "$V" ] || { echo "member-proof: installed '${got:-nothing}', expected $V; see $E/install.txt"; exit 1; }
# The isolated folder holds no sign-in, so the runs use yours, with only the member's installed plugins loaded.
plugins=(); while IFS= read -r d; do plugins+=(--plugin-dir "$d"); done < <(jq -r '.plugins[][0].installPath' "$CLAUDE_CONFIG_DIR/plugins/installed_plugins.json")
unset CLAUDE_CONFIG_DIR
git clone -q --branch "v$V" "$root" "$W/clone" && cp -R tests/member-proof "$W/input"
cd "$W/clone" || exit 1
# Least privilege: these runs use the releaser's own sign-in, so no general shell. Only the fork script, read-only git,
# validation of the plugins folder and the read-only doctor; Glob and Grep instead of find, and fork.sh copies, not cp.
tools=(Read Glob Grep Write Edit "Bash(sh */skills/plugin/scripts/fork.sh *)" "Bash(git status*)" "Bash(git diff*)"
  "Bash(git log*)" "Bash(ls *)" "Bash(jq *)" "Bash(mkdir *)" "Bash(claude plugin validate --strict plugins/*)" "Bash(1xops doctor*)")
run() { # case, max turns, prompt
  local t0; t0=$(date +%s)
  timeout 900 claude -p "$3" "${plugins[@]}" --setting-sources local --max-turns "$2" --output-format json \
    --add-dir "$W/input" --allowedTools "${tools[@]}" >"$E/$1.json" 2>"$E/$1.err" </dev/null
  echo "$1: exit $?, $(( $(date +%s) - t0 ))s, cost $(jq -r '.total_cost_usd // "n/a"' "$E/$1.json" 2>/dev/null) USD" | tee -a "$E/summary.txt"
  git status --short >"$E/$1.git-status.txt"
}
check() { if eval "$2"; then echo "  pass: $1" | tee -a "$E/summary.txt"; else echo "  FAIL: $1" | tee -a "$E/summary.txt"; fails=$((fails + 1)); fi; }
cp .claude-plugin/marketplace.json "$E/marketplace.before.json"
run customize 30 "/1xops:plugin copy Copy the catalogue plugin operations into our own plugin named acme-ops, in plugins/. Headless run: the answers are in $W/input/brief.md (name confirmed: acme-ops; NOTICE line: yes). Do not list it in marketplace.json. End with the review list."
check "copy with licence and origin" '[ -f plugins/acme-ops/UPSTREAM.md ] && ls plugins/acme-ops/LICENSE* >/dev/null 2>&1 && grep -q acme-ops NOTICE'
release_check() { for s in $(jq -r '.plugins[].source' .claude-plugin/marketplace.json); do p=${s#./}; { [ -L "$p" ] || [ ! -d "$p" ]; } && return 1; done; return 0; }
cp .claude-plugin/marketplace.json "$W/mp.json"
jq '.plugins += [{"name":"operations","source":"./plugins/operations"}]' "$W/mp.json" >.claude-plugin/marketplace.json
check "release check refuses a listed link" '! release_check'
jq '.plugins += [{"name":"acme-ops","source":"./plugins/acme-ops"}]' "$W/mp.json" >.claude-plugin/marketplace.json
check "release check accepts a listed copy" 'release_check'
cp "$W/mp.json" .claude-plugin/marketplace.json; rm -rf plugins/acme-ops; git checkout -q -- NOTICE
run discover 30 "/1xops:discover Show me the last time you did this job: $W/input/2026-10-cost-review.md and its tickets $W/input/tickets.csv. Headless run: the answers are in $W/input/brief.md. Write the workflow spec."
spec=$(find workflows -name spec.md 2>/dev/null | head -1)
check "spec written, nothing else changed" '[ -n "$spec" ] && [ -z "$(git status --short | grep -v "workflows/")" ]'
run plugin-make 60 "/1xops:plugin make ${spec:-workflows} Headless run: answers are in $W/input/brief.md; the component plan you propose is approved; name the plugin acme-cost-review. Build it in plugins/, validate it strictly, do not list it in marketplace.json."
check "new plugin passes strict validation" 'claude plugin validate --strict plugins/acme-cost-review >"$E/validate.txt" 2>&1'
run recommend 40 "/1xops:check setup Recommend a setup for this repository. Headless run: write the report as your answer, change nothing."
check "recommendations marked, nothing changed by them" 'jq -r .result "$E/recommend.json" | grep -qiE "approved|tested" && cmp -s .claude-plugin/marketplace.json "$E/marketplace.before.json"'
echo "member-proof: v$V, $fails failed; evidence in $E (local, not posted)" | tee -a "$E/summary.txt"
exit $((fails > 0))
