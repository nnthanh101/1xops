#!/usr/bin/env bash
# verify-release.sh VERSION - prove what customers receive: install 1xops VERSION from each channel in a clean
# container, as a non-root user, with the README's install command, and run the same checks. Prints a Markdown
# evidence table with the measured seconds from `docker run` (image pull included) to the check's result.
# Exit 0 only when every channel passes. Read-only on the registries; needs Docker. `task release` runs it.
set -uo pipefail
V=${1:?usage: verify-release.sh VERSION}
fails=0
logs=$(mktemp -d)
trap 'rm -rf "$logs"' EXIT

# The checks every channel must pass, run inside the container as `1xops` (one string, run by sh -c).
CHECKS='set -e
cd "$HOME"
export COLUMNS=200
v=$(1xops --version)
1xops connectors >/dev/null
mkdir -p org && 1xops config --scope org --out org --connectors aws azure itsm --yes >/dev/null
grep -q "@azure/mcp@" org/managed-mcp.json && ! grep -q "@latest" org/managed-mcp.json
grep -q "mcp__atlassian__\*" org/managed-settings.json
grep -q "Bash(aws \* delete-\*)" org/managed-settings.json && grep -q "Bash(az \* delete\*)" org/managed-settings.json
mkdir -p p && if 1xops config --scope local --dir p --connectors aws --yes >/dev/null 2>&1; then exit 3; fi
[ -z "$(ls -A p)" ]
mkdir -p first && cd first
1xops doctor >doctor.txt 2>&1 || true
grep -Eq "│ connectors +│ connector +│ missing +│ no \.env\.1xops here: run 1xops setup" doctor.txt
printf "ONEXOPS_CONNECTORS=aws\nAWS_BILLING_PROFILE=readonly\nAWS_OPERATIONS_PROFILE=readonly\n" >.env.1xops
sum=$(cksum .env.1xops)
1xops doctor >doctor.txt 2>&1 || true
# without the AWS CLI (PyPI, npm) the fix is to install it; the image ships it, so the fix is the missing profile
grep -Eq "│ aws AWS_BILLING_PROFILE +│ connector +│ missing +│ (install the AWS CLI|profile readonly not found: aws configure sso)" doctor.txt
[ "$sum" = "$(cksum .env.1xops)" ]
grep " connector " doctor.txt >"$HOME/connectors.txt"
echo "$v; doctor names each signed-out or missing connector with its fix and changes nothing; profiles, org config (pinned, Jira and cloud writes ask first), local scope writes nothing without the host CLI"'

row() { # channel, image, install command (the README's), extra docker args, "registry serves it" check
  local key=${1//[^A-Za-z0-9]/_} start code out secs
  local log="$logs/$key.log"
  # Registry edges lag a new version by minutes: a failed channel is tried again (up to 10 times, 30 s apart)
  # only while its registry does not serve the version yet. Once it does, a failure is real and reported at once.
  for try in 1 2 3 4 5 6 7 8 9 10; do
    start=$(date +%s)
    # shellcheck disable=SC2086
    docker run --rm --pull always $4 --entrypoint sh "$2" -c "set -e; $3; $CHECKS; cat \$HOME/connectors.txt >&2" >"$log" 2>"$logs/$key.connectors"
    code=$?
    secs=$(( $(date +%s) - start ))
    out=$(sed -n '$p' "$log")
    [ "$code" -eq 0 ] && [ -n "$out" ] && break
    eval "$5" >/dev/null 2>&1 && break
    [ "$try" -lt 10 ] && sleep 30
  done
  secs="${secs}s"; [ "$try" -gt 1 ] && secs="$secs (try $try)"
  if [ "$code" -eq 0 ] && [[ "$out" == "1xops $V;"* ]]; then
    echo "| $1 | pass | $secs | $out |"
  else
    echo "| $1 | **FAIL** (exit $code) | $secs | ${out:-no output} |"; fails=$((fails + 1))
  fi
}

echo "**1xops $V, verified $(date -u +%Y-%m-%dT%H:%MZ) in clean containers as a non-root user** (\`scripts/verify-release.sh $V\`)"
echo
echo "| Channel | Result | Seconds, pull to result | Output |"
echo "|---|---|---|---|"
U='--user 1000:1000 -e HOME=/tmp/home'
row "PyPI (uv, python 3.14)" ghcr.io/astral-sh/uv:python3.14-trixie-slim \
  "mkdir -p \$HOME; unset UV_TOOL_BIN_DIR; uv tool install -q 1xops==$V >/dev/null 2>&1; export PATH=\$HOME/.local/bin:\$PATH" "$U" \
  "curl -sf -H 'Accept: application/vnd.pypi.simple.v1+json' https://pypi.org/simple/1xops/ | grep -q '\"$V\"'"
row "npm (node:24-slim, no Python)" node:24-slim \
  "mkdir -p \$HOME; npm install -g --silent --prefix \$HOME/.npm 1xops@$V >/dev/null 2>&1; export PATH=\$HOME/.npm/bin:\$PATH" "$U" \
  "curl -sfI https://registry.npmjs.org/1xops/-/1xops-$V.tgz"
row "Docker Hub nnthanh101/1xops:$V" "nnthanh101/1xops:$V" "export HOME=/tmp/home; mkdir -p \$HOME" "" "docker buildx imagetools inspect nnthanh101/1xops:$V"
row "ghcr.io/nnthanh101/1xops:$V" "ghcr.io/nnthanh101/1xops:$V" "export HOME=/tmp/home; mkdir -p \$HOME" "" "docker buildx imagetools inspect ghcr.io/nnthanh101/1xops:$V"

# Python and Node.js must print the same connector rows. Column widths follow each container's own tool rows, so
# spacing is normalised here; byte-for-byte equality on one machine is checked by `task test`.
py_rows="$logs/PyPI__uv__python_3_14_.connectors" js_rows="$logs/npm__node_24_slim__no_Python_.connectors"
norm() { grep ' connector ' "$1" | sed -E 's/ +/ /g; s/ $//'; } # stderr also holds docker's pull lines
if [ -n "$(norm "$py_rows")" ] && [ "$(norm "$py_rows")" = "$(norm "$js_rows")" ]; then # empty is a failure
  echo "| PyPI and npm print the same connector rows | pass | | spacing normalised |"
else
  echo "| PyPI and npm print the same connector rows | **FAIL** | | differ or empty |"; fails=$((fails + 1))
fi
hub=$(docker buildx imagetools inspect "nnthanh101/1xops:$V" 2>/dev/null | awk '/^Digest/{print $2}')
gh=$(docker buildx imagetools inspect "ghcr.io/nnthanh101/1xops:$V" 2>/dev/null | awk '/^Digest/{print $2}')
if [ -n "$hub" ] && [ "$hub" = "$gh" ]; then echo "| Same image on both registries | pass | | \`$hub\` |"; else echo "| Same image on both registries | **FAIL** | | Docker Hub ${hub:-none}, ghcr.io ${gh:-none} |"; fails=$((fails + 1)); fi
echo
[ "$fails" -eq 0 ] && echo "All channels pass." || echo "$fails check(s) failed."
exit "$fails"
