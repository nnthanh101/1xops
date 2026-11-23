#!/usr/bin/env bash
# metrics.sh [DAYS=90] - the four delivery measures of this repository, from git tags and the Release runs on GitHub.
# Read-only. Deployment frequency: releases published in the window. Lead time: median hours from a change's commit to
# its release being published. Change failure rate: releases followed within 7 days by a release whose commits fix
# something (a "fix:" commit) - an approximation, said as one. Time to restore: median hours from that release to the fix.
set -euo pipefail
R=nnthanh101/1xops; DAYS=${DAYS:-90}
cd "$(git rev-parse --show-toplevel)"; git fetch -q origin --tags
since=$(( $(date +%s) - DAYS * 86400 ))
runs=$(gh run list -R $R -w release.yml -L 200 --json headBranch,conclusion,updatedAt,event \
  --jq '[.[] | select(.conclusion=="success" and (.headBranch|test("^v[0-9]")))]')
published() { # epoch seconds when tag $1's Release run succeeded; empty when it never did
  local t; t=$(jq -r --arg b "$1" '[.[] | select(.headBranch==$b)] | sort_by(.updatedAt) | .[0].updatedAt // empty' <<<"$runs")
  [ -z "$t" ] && return 0
  date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$t" +%s 2>/dev/null || date -u -d "$t" +%s
}
median() { sort -g | awk '{a[NR]=$1} END {if (!NR) print "n/a"; else if (NR%2) print a[(NR+1)/2]; else print (a[NR/2]+a[NR/2+1])/2}'; }
tags=(); while IFS= read -r t; do tags+=("$t"); done < <(git tag --list 'v*' --sort=v:refname); n=0; leads=(); fails=0; restores=(); failed=()
for i in "${!tags[@]}"; do
  t=${tags[$i]}; p=$(published "$t"); [ -n "$p" ] && [ "$p" -ge "$since" ] || continue
  n=$((n + 1)); prev=""; [ "$i" -gt 0 ] && prev=${tags[$((i - 1))]}
  # the changes only: merge and version-bump commits are made minutes before publishing and would hide the wait
  [ -n "$prev" ] && for c in $(git log --no-merges --format='%ct %s' "$prev..$t" | grep -v ' chore: release ' | cut -d' ' -f1); do
    leads+=("$(awk -v a="$p" -v b="$c" 'BEGIN{printf "%.1f", (a-b)/3600}')"); done
  next=""; [ $((i + 1)) -lt ${#tags[@]} ] && next=${tags[$((i + 1))]}
  if [ -n "$next" ]; then
    q=$(published "$next")
    # the subjects are read first: grep -q stops early and, under pipefail, git's broken pipe would read as "no fix"
    subjects=$(git log --format=%s "$t..$next")
    if [ -n "$q" ] && [ $((q - p)) -le $((7 * 86400)) ] && grep -qE '^fix(\(|:)' <<<"$subjects"; then
      fails=$((fails + 1)); failed+=("$t fixed by $next"); restores+=("$(awk -v a="$q" -v b="$p" 'BEGIN{printf "%.1f", (a-b)/3600}')")
    fi
  fi
done
echo "Delivery measures, last $DAYS days (from tags and Release runs; read-only)"
echo "| Measure | Value |"; echo "|---|---|"
echo "| Releases published (deployment frequency) | $n ($(awk -v n=$n -v d=$DAYS 'BEGIN{printf "%.1f", n*7/d}') a week) |"
echo "| Lead time, commit to published (median hours) | $(printf '%s\n' "${leads[@]:-}" | grep . | median) |"
echo "| Change failure rate (a fix released within 7 days) | $([ $n -gt 0 ] && awk -v f=$fails -v n=$n 'BEGIN{printf "%d of %d (%.0f%%)", f, n, 100*f/n}' || echo n/a) |"
echo "| Time to restore (median hours to that fix) | $(printf '%s\n' "${restores[@]:-}" | grep . | median) |"
printf "Counted as a failure: %s\n" "${failed[@]:-none}"
