#!/usr/bin/env bash
# evals.sh - replay the builder skills' cases (plugins/1xops/evals) as a member would and print, per case, the score and
# its gain over the same prompt without the plugin. Model runs on your own sign-in: they cost money, so the run stops at
# MAX_USD. The report stays local in tmp/evals/ (never published). Exit 0 always: the score is advice for the release
# question; the owner decides. Usage: RUNS=1 MAX_USD=15 CASE='discover-*' bash scripts/evals.sh
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
out=tmp/evals/$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$out"; ln -sfn "$(basename "$out")" tmp/evals/latest
# A plugin that declares dependencies loads nothing when one is missing (1xops declares none since 24 Nov 2026), and the eval's sandbox has none of them: the
# with-plugin arm would then grade the host alone. So the cases run on a copy without `dependencies`; none of them needs
# a library plugin (a case that does says so in its prompt).
copy=$(mktemp -d)/1xops; trap 'rm -rf "$(dirname "$copy")"' EXIT
cp -R plugins/1xops "$copy" && rm -rf "$copy/evals/results"
jq 'del(.dependencies)' plugins/1xops/.claude-plugin/plugin.json >"$copy/.claude-plugin/plugin.json"
args=("$copy" --runs "${RUNS:-1}" --concurrency "${JOBS:-4}" --max-cost-usd "${MAX_USD:-15}" --threshold 0
  --no-publish --trust-plugin --output-dir "$out" --report "$out/report.html" --json "$out/result.json")
[ -n "${CASE:-}" ] && args+=(--case "$CASE")
claude plugin eval "${args[@]}" >"$out/eval.log" 2>&1; code=$?
if [ ! -s "$out/result.json" ]; then
  echo "evals: no result (exit $code); see $out/eval.log" | tee "$out/summary.txt"; tail -5 "$out/eval.log"; exit 0
fi
bash scripts/evals-summary.sh "$out/result.json" | tee "$out/summary.txt"
echo "evals: report $out/report.html (local, not published)"
