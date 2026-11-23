#!/usr/bin/env bash
# evals-summary.sh result.json - one line per case: the score with the plugin, without it, and the gain; then the totals.
# A gain of 0 means the plugin did not change the answer, so that case proves nothing about the plugin.
set -euo pipefail
jq -r '
  def r: if type == "number" then (. * 100 | round / 100 | tostring) else "n/a" end;
  "| Case | With the plugin | Without | Gain |", "|---|---|---|---|",
  (.cases[] | .aggregates as $a | "| \(.name) | \($a.score | r) | \($a.scoreWithout | r) | \($a.delta | r) |"),
  "",
  "Full score with the plugin: \([.cases[] | select((.aggregates.score // 0) >= 1)] | length) of \(.cases | length) cases; without it: \([.cases[] | select((.aggregates.scoreWithout // 0) >= 1)] | length). Mean score \(.aggregates.overallScore | r), mean gain \(.aggregates.meanDelta | r). Model cost \(.costUsd | r) USD in \(.durationSeconds) s\(if .partial then "; stopped early at the cost ceiling" else "" end)."
' "$1"
