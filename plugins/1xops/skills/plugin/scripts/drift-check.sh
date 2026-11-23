#!/bin/sh
# One source per rule: fails when a plugin keeps its own copy of a shared file.
#   1. A skill holds a copy of a file the plugin keeps once in its root references/ folder.
#   2. A file copied from elsewhere (one "source copy" pair per line in PAIRS) no longer matches its source.
# Usage: drift-check.sh [--pairs FILE] [plugin folder ...] (default: every folder in plugins/).
# Prints one line per problem, or "drift: ok" on a pass.
set -u
pairs=
if [ "${1:-}" = --pairs ]; then pairs=$2; shift 2; fi
[ $# -gt 0 ] || set -- plugins/*/
bad=0
checked=0

for plugin in "$@"; do
  plugin=${plugin%/}/
  [ -d "$plugin/references" ] || continue
  for shared in "$plugin"references/*; do
    [ -f "$shared" ] || continue
    name=$(basename "$shared")
    for copy in "$plugin"skills/*/references/"$name"; do
      [ -f "$copy" ] || continue
      checked=$((checked + 1))
      if cmp -s "$shared" "$copy"; then
        echo "drift: $copy is a copy of ${plugin}references/$name; point the skill to \${CLAUDE_PLUGIN_ROOT}/references/$name"
      else
        echo "drift: $copy differs from ${plugin}references/$name; the skill reads an old rule"
      fi
      bad=1
    done
  done
done

if [ -n "$pairs" ]; then
  [ -f "$pairs" ] || { echo "drift: pairs file $pairs not found"; exit 2; }
  while read -r src copy; do
    case "$src" in ''|'#'*) continue ;; esac
    checked=$((checked + 1))
    if [ ! -f "$src" ]; then echo "drift: source $src not found (for $copy)"; bad=1
    elif [ ! -f "$copy" ]; then echo "drift: copy $copy not found (from $src)"; bad=1
    elif ! cmp -s "$src" "$copy"; then echo "drift: $copy differs from $src"; bad=1
    fi
  done < "$pairs"
fi

[ "$bad" -eq 0 ] && echo "drift: ok ($checked compared)"
exit "$bad"
