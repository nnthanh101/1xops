#!/bin/sh
# Copy a catalogue plugin into its own folder under a new name, keep its licence and origin,
# and list everything in it that can run commands or change things. Never edits marketplace.json.
# Usage: fork.sh <source-plugin-folder> <new-name> [--dest <parent-folder>] [--notice <NOTICE file>]
# Exit: 0 copied · 2 bad input · 3 destination exists · 4 no licence · 5 a link leaves the plugin
#       6 a file name holds a control character
set -eu
# Text from the source (names, keys, commands) never carries control characters into the output.
clean() { LC_ALL=C tr -d '\001-\010\013-\037\177'; }

usage() { echo "usage: fork.sh <source-plugin-folder> <new-name> [--dest <parent>] [--notice <NOTICE>]" >&2; exit 2; }
[ $# -ge 2 ] || usage
src_in=$1; name=$2; shift 2
dest_parent=""; notice=""
while [ $# -gt 0 ]; do
  case $1 in
    --dest) [ $# -ge 2 ] || usage; dest_parent=$2; shift 2 ;;
    --notice) [ $# -ge 2 ] || usage; notice=$2; shift 2 ;;
    *) usage ;;
  esac
done

case $name in
  *[!a-z0-9-]*|-*|"") echo "name '$name' must be lowercase kebab-case (a-z, 0-9, -)" >&2; exit 2 ;;
esac
# A fresh `git clone` leaves the vendor libraries (git submodules) empty, so a catalogue link points nowhere.
# Fetch only the one library the link points into, shallow, and say so; nothing else changes.
if [ -L "$src_in" ] && [ ! -e "$src_in" ]; then
  top=$(git -C "$(dirname "$src_in")" rev-parse --show-toplevel 2>/dev/null) || top=""
  t=$(readlink "$src_in")
  if [ -n "$top" ] && [ -f "$top/.gitmodules" ]; then
    for sp in $(git -C "$top" config -f .gitmodules --get-regexp 'submodule\..*\.path' | awk '{print $2}'); do
      case $t in (*"$sp"/*|*"$sp")
        echo "fetching the catalogue library $sp (a fresh clone does not include it)" >&2
        git -C "$top" submodule update --init --depth 1 -- "$sp" >&2 || { echo "could not fetch $sp: run git submodule update --init $sp" >&2; exit 2; }
        break ;;
      esac
    done
  fi
fi
[ -d "$src_in" ] || { echo "source '$src_in' is not a folder" >&2; exit 2; }
src=$(cd -P "$src_in" && pwd -P)
[ -f "$src/.claude-plugin/plugin.json" ] || { echo "source '$src_in' has no .claude-plugin/plugin.json: not a plugin" >&2; exit 2; }
[ -n "$dest_parent" ] || dest_parent=$(dirname "$src_in")
dest="$dest_parent/$name"
[ ! -e "$dest" ] || { echo "'$dest' already exists: choose another name or remove it first" >&2; exit 3; }

# A file name with a new line or an escape could forge or hide a line of the review list: refuse it.
bad=$(LC_ALL=C find "$src" -name "$(printf '*[\001-\037\177]*')" | wc -l | tr -d ' ')
[ "$bad" = 0 ] || { echo "file names in '$src_in' hold control characters ($bad): copy stopped, nothing written" >&2; exit 6; }

# Links: the copy holds only the plugin's own files. A link inside the plugin is copied as the file it
# points to; a link that leaves the plugin, or cannot be followed, stops the copy before anything is written.
resolve() { # print the physical path a link finally points to; nothing if it cannot be followed
  p=$1; i=0
  while [ -L "$p" ] && [ "$i" -lt 40 ]; do
    t=$(readlink "$p")
    case $t in /*) p=$t ;; *) p=$(dirname "$p")/$t ;; esac
    i=$((i + 1))
  done
  [ -e "$p" ] || return 0
  # cd -P: the kernel follows each link before applying "..", exactly as cp will; never the text of the path
  if [ -d "$p" ]; then (cd -P "$p" 2>/dev/null && pwd -P) || true
  else d=$(cd -P "$(dirname "$p")" 2>/dev/null && pwd -P) && printf '%s/%s\n' "$d" "$(basename "$p")"
  fi
}
links=$(find "$src" -type l | while IFS= read -r l; do
  case $(resolve "$l") in ("$src"/*) k=in ;; (*) k=out ;; esac
  printf '%s %s -> %s\n' "$k" "${l#"$src"/}" "$(readlink "$l")"
done)
escapes=$(printf '%s\n' "$links" | sed -n 's/^out /  /p')
if [ -n "$escapes" ]; then
  printf "links that leave '%s' or cannot be followed: copy stopped, nothing written\n%s\n" "$src_in" "$escapes" >&2
  exit 5
fi
copied_links=$(printf '%s\n' "$links" | sed -n 's/^in /- link copied as the file it points to: /p')

# Origin: the git repository the source lives in, and the commit it is pinned at. Never a sign-in:
# any user or token in the remote address is dropped before it is written anywhere.
repo_url=unknown; commit=unknown; rel=$src
if top=$(git -C "$src" rev-parse --show-toplevel 2>/dev/null); then
  commit=$(git -C "$src" rev-parse HEAD)
  repo_url=$(git -C "$src" remote get-url origin 2>/dev/null || echo unknown)
  repo_url=$(printf '%s' "$repo_url" | sed -E 's#^([A-Za-z][A-Za-z0-9+.-]*://)[^/@]*@#\1#' | clean)
  rel=$(printf '%s' "${src#"$top"/}" | clean | tr -d '|`')
fi
old_name=$(sed -n 's/^[[:space:]]*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$src/.claude-plugin/plugin.json" | head -n 1 | clean | tr -d '|`')

mkdir -p "$dest_parent"
cp -RL "$src" "$dest"

# Licence: keep the plugin's own; else take the repository's, cut at the end of the licence text.
licence_file=""
for f in LICENSE LICENSE.txt LICENSE.md COPYING; do
  [ -f "$dest/$f" ] && { licence_file="$f (the plugin's own)"; break; }
done
if [ -z "$licence_file" ] && [ -n "${top:-}" ] && [ -f "$top/LICENSE" ]; then
  if head -n 3 "$top/LICENSE" | grep -q "Apache License"; then
    last=$(grep -n "limitations under the License\." "$top/LICENSE" | tail -n 1 | cut -d: -f1)
    if [ -n "$last" ]; then head -n "$last" "$top/LICENSE" > "$dest/LICENSE"; else cp "$top/LICENSE" "$dest/LICENSE"; fi
  else
    cp "$top/LICENSE" "$dest/LICENSE"
  fi
  licence_file="LICENSE (copied from the repository root)"
fi
[ -n "$licence_file" ] || { echo "no licence found for '$src_in': copy stopped, '$dest' removed" >&2; rm -rf "$dest"; exit 4; }
licence_name=$(head -n 5 "$dest/LICENSE"* 2>/dev/null | grep -o -m 1 -E "Apache License|MIT License|BSD [0-9]-Clause|Mozilla Public License|GNU [A-Z ]*General Public License" || echo "see LICENSE")
[ "$licence_name" = "Apache License" ] && licence_name="Apache-2.0"

# Rename: only the plugin's own name, the first "name" key in plugin.json.
pj="$dest/.claude-plugin/plugin.json"
awk -v n="$name" 'done==0 && /"name"[[:space:]]*:/ { sub(/"name"[[:space:]]*:[[:space:]]*"[^"]*"/, "\"name\": \"" n "\""); done=1 } { print }' "$pj" > "$pj.tmp" && mv "$pj.tmp" "$pj"

# Review list: everything that can run a command, reach a service or change files. It never fails open:
# a file that cannot be read is listed as "check by hand", never left out.
review=$(
  set +e
  cd "$dest" || { echo "- check by hand: the copy at $dest could not be opened"; exit 0; }
  has_jq=$(command -v jq)

  servers() { # $1: a connector file, with or without the "mcpServers" wrapper
    if [ -z "$has_jq" ]; then echo "- check by hand: $1 lists connectors (jq is not installed to read them)"; return; fi
    jq -r '(if has("mcpServers") then .mcpServers else . end) | keys[] | "- connector: " + gsub("[[:cntrl:]]"; " ")' "$1" 2>/dev/null \
      || echo "- check by hand: $1 could not be read as connectors"
  }
  hooks() { # $1: a hook file; each hook runs on its event without being asked
    if [ -z "$has_jq" ]; then echo "- check by hand: $1 runs hooks without being asked (jq is not installed to read them)"; return; fi
    jq -r --arg f "$1" '(.hooks // .) | to_entries[] | .key as $e
      | (.value | if type == "array" then .[] else . end) | (.hooks // [.]) | .[]
      | "- hook: \($f) runs on \($e) without being asked: \(.command // .prompt // .url // .type // "see file")"
      | gsub("[[:cntrl:]]"; " ")' "$1" 2>/dev/null \
      || echo "- check by hand: $1 could not be read as hooks"
  }
  declared() { # $1: kind (connectors|hooks), $2: a path from plugin.json
    p=${2#\$\{CLAUDE_PLUGIN_ROOT\}/}; p=${p#./}
    case $p in
      (/*|*..*) echo "- check by hand: plugin.json names $1 outside the plugin: $2" ;;
      (*) if [ ! -f "$p" ]; then echo "- check by hand: plugin.json names $1 file $2, which is missing"
         elif [ "$1" = connectors ]; then servers "$p"; else hooks "$p"; fi ;;
    esac
  }

  # Connectors and hooks: the default files, and whatever plugin.json declares.
  [ -f .mcp.json ] && servers .mcp.json
  [ -f hooks/hooks.json ] && hooks hooks/hooks.json
  if [ -z "$has_jq" ]; then
    if grep -q -E '"(mcpServers|hooks)"' .claude-plugin/plugin.json; then
      echo "- check by hand: .claude-plugin/plugin.json declares connectors or hooks (jq is not installed to read them)"
    fi
  else
    refs=$(jq -r 'def each: if type == "array" then .[] else . end;
      (.mcpServers // empty | each | if type == "string" then "connectors " + . else (keys[] | "inline-connector " + .) end),
      (.hooks // empty | each | if type == "string" then "hooks " + . else "inline-hooks -" end)
      | gsub("[[:cntrl:]]"; " ")' .claude-plugin/plugin.json 2>/dev/null) \
      || echo "- check by hand: .claude-plugin/plugin.json could not be read for connectors and hooks"
    printf '%s\n' "$refs" | while IFS= read -r ref; do
      [ -n "$ref" ] || continue
      kind=${ref%% *}; path=${ref#* }
      case $kind in
        (connectors|hooks) declared "$kind" "$path" ;;
        (inline-connector) echo "- connector: $path (declared in plugin.json)" ;;
        (inline-hooks) echo "- hook: plugin.json declares hooks that run without being asked" ;;
      esac
    done
  fi
  [ -f .lsp.json ] && echo "- language server: .lsp.json starts a program"
  [ -f settings.json ] && echo "- settings: settings.json changes the session's defaults while the plugin is on"

  # Scripts: by extension, by the execute bit, or by a #! first line.
  find . -type f \( -perm -100 -o -name '*.sh' -o -name '*.bash' -o -name '*.py' -o -name '*.js' -o -name '*.mjs' \
    -o -name '*.cjs' -o -name '*.ts' -o -name '*.ps1' -o -name '*.rb' \) | sed 's|^\./||; s/^/- script: /'
  find . -type f | while IFS= read -r f; do
    if [ "$(head -c 2 "$f" 2>/dev/null)" = "#!" ]; then printf -- '- script: %s\n' "${f#./}"; fi
  done

  # Skills, commands and helpers: tools in the front matter, inline or as a list. A helper with no
  # tools list gets every tool.
  find . -type f -name '*.md' -exec awk '
    function flush(  f) {
      if (file == "" || !hasfm) return
      f = file; sub(/^\.\//, "", f)
      if (buf ~ /(^|[^A-Za-z])(Bash|Write|Edit|MultiEdit|NotebookEdit)([^A-Za-z]|$)|mcp__/) print "- can write or run commands: " f
      else if (!seen && f ~ /(^|\/)agents\/[^\/]+\.md$/) print "- helper with every tool (no tools list): " f
    }
    FNR == 1 { flush(); file = FILENAME; hasfm = ($0 == "---"); infm = hasfm; seen = 0; grab = 0; buf = ""; next }
    infm && $0 == "---" { infm = 0; next }
    infm && /^(allowed-)?tools:/ { seen = 1; grab = 1; buf = buf " " $0; next }
    infm && grab && /^[ \t]/ { buf = buf " " $0; next }
    infm { grab = 0 }
    END { flush() }' {} +
  grep -rl '!`' --include='*.md' . 2>/dev/null | sed 's|^\./||; s/^/- runs a shell command when loaded: /'
  [ -n "$copied_links" ] && printf '%s\n' "$copied_links"
  exit 0
)
review=$(printf '%s\n' "$review" | clean | awk 'NF && !seen[$0]++')
[ -n "$review" ] || review="- nothing found that runs commands, reaches a service or changes files"

today=$(date +%Y-%m-%d)
notice_line="  $name  derived on $today from $repo_url ($rel, commit $commit)  $licence_name  $dest"
cat > "$dest/UPSTREAM.md" <<REC
# Origin of $name

| | |
|---|---|
| Copied from | \`$rel\` (plugin \`$old_name\`) |
| Repository | $repo_url |
| Pinned commit | \`$commit\` |
| Copied on | $today |
| Licence | $licence_name, $licence_file |

Changes from the source are this team's own. To take an upstream update, compare the source at the commit above with
the new pin, and apply only what the team approves. This folder never changes by itself.

## Review before it ships

Decide for each line: keep, remove, or keep but ask a person first. A "check by hand" line is a file the copy could
not read: open it and decide the same way. It ships only once it is listed in \`marketplace.json\`, and the release
check accepts only folders, never links. The list is plain text, so a name in it can never hide another line.

\`\`\`text
$review
\`\`\`
REC

if [ -n "$notice" ]; then
  [ -f "$notice" ] || { echo "NOTICE file '$notice' not found" >&2; exit 2; }
  if ! grep -q "derived on .* $dest\$" "$notice"; then
    [ -z "$(tail -c 1 "$notice")" ] || printf '\n' >> "$notice"
    printf '%s\n' "$notice_line" >> "$notice"
  fi
fi

echo "Copied $src_in to $dest as '$name' (was '$old_name')."
echo "Origin: $repo_url, $rel, commit $commit. Licence: $licence_name ($licence_file)."
echo "Review before it ships:"
printf '%s\n' "$review"
echo "NOTICE line:"
printf '%s\n' "$notice_line"
[ -n "$notice" ] && echo "(added to $notice)"
echo "marketplace.json was not changed."
