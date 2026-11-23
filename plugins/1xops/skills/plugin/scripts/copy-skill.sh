#!/bin/sh
# Copy one skill from a catalogue plugin into a plugin the team owns, and record where it came from in the
# receiving plugin's UPSTREAM.md (source, pinned commit, date, licence). Never edits marketplace.json.
# Usage: copy-skill.sh <source-skill-folder> <receiving-plugin-folder>
# Exit: 0 copied · 2 bad input · 3 the skill already exists there · 5 a link leaves the skill · 6 a control character
set -eu
clean() { LC_ALL=C tr -d '\001-\010\013-\037\177'; }

[ $# -eq 2 ] || { echo "usage: copy-skill.sh <source-skill-folder> <receiving-plugin-folder>" >&2; exit 2; }
[ -f "$1/SKILL.md" ] || { echo "'$1' has no SKILL.md: not a skill" >&2; exit 2; }
[ -f "$2/.claude-plugin/plugin.json" ] || { echo "'$2' has no .claude-plugin/plugin.json: not a plugin" >&2; exit 2; }
src=$(cd -P "$1" && pwd -P)
skill=$(basename "$src")
dest="$2/skills/$skill"
[ ! -e "$dest" ] || { echo "'$dest' already exists: compare it with the source instead of copying over it" >&2; exit 3; }

bad=$(LC_ALL=C find "$src" -name "$(printf '*[\001-\037\177]*')" | wc -l | tr -d ' ')
[ "$bad" = 0 ] || { echo "file names in '$1' hold control characters: nothing copied" >&2; exit 6; }
out=$(find "$src" -type l | while IFS= read -r l; do
  t=$(readlink "$l"); case $t in (/*) p=$t ;; (*) p=$(dirname "$l")/$t ;; esac
  d=$( (cd -P "$(dirname "$p")" 2>/dev/null && pwd -P) || echo /)
  case $d in ("$src"|"$src"/*) ;; (*) printf '%s\n' "${l#"$src"/}" ;; esac
done)
[ -z "$out" ] || { printf "links that leave the skill, nothing copied:\n%s\n" "$out" >&2; exit 5; }

repo_url=unknown; commit=unknown; rel=$src; licence=""
if top=$(git -C "$src" rev-parse --show-toplevel 2>/dev/null); then
  commit=$(git -C "$src" rev-parse HEAD)
  repo_url=$(git -C "$src" remote get-url origin 2>/dev/null || echo unknown)
  repo_url=$(printf '%s' "$repo_url" | sed -E 's#^([A-Za-z][A-Za-z0-9+.-]*://)[^/@]*@#\1#' | clean)
  rel=$(printf '%s' "${src#"$top"/}" | clean | tr -d '|`')
  [ -f "$top/LICENSE" ] && licence=$(head -n 5 "$top/LICENSE" | grep -o -m 1 -E "Apache License|MIT License|BSD [0-9]-Clause" || true)
fi
own=$(sed -n 's/^license:[[:space:]]*//p' "$src/SKILL.md" | head -n 1 | clean | tr -d '|`')
[ -n "$own" ] && licence=$own
[ "$licence" = "Apache License" ] && licence="Apache-2.0"
[ -n "$licence" ] || licence="check by hand: no licence found"

mkdir -p "$2/skills"
cp -RL "$src" "$dest"
find "$dest" \( -name .DS_Store -o -name __pycache__ \) -prune -exec rm -rf {} +

up="$2/UPSTREAM.md"
if [ ! -f "$up" ]; then
  printf '# Origin of copied parts\n\nEach row is a part copied from the catalogue. To take an update, compare the source at the pinned\ncommit with the new one and apply only what the team approves.\n\n| Part | Copied from | Repository | Pinned commit | Copied on | Licence |\n|---|---|---|---|---|---|\n' > "$up"
fi
printf '| skills/%s | `%s` | %s | `%s` | %s | %s |\n' "$skill" "$rel" "$repo_url" "$commit" "$(date +%Y-%m-%d)" "$licence" >> "$up"

echo "Copied skill '$skill' into $dest. Origin: $repo_url, $rel, commit $commit. Licence: $licence."
echo "Recorded in $up. Review it before it ships: open its SKILL.md and any scripts it holds."
