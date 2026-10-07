#!/usr/bin/env bash
# What changed upstream, in the pages this skill cites, since the pinned commit.
#
#   .claude/skills/linked-art/scripts/upstream-changes.sh [--diff]
#
# Clones Linked Art's documentation into a temporary directory (it is never kept in this
# repository; the pin in upstream.txt is the shared reference point), then lists the
# commits since the pin that touched a cited page, and with --diff shows the changes.
# Moving the pin is a reviewed change: re-check the affected reference files first.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
pin="$(awk '/^commit:/ {print $2}' "$here/upstream.txt")"
repo="$(awk '/^repo:/ {print $2}' "$here/upstream.txt")"
cited=()
while IFS= read -r line; do cited+=("$line"); done < <(awk '/^cited:/ {on=1; next} on && NF {print $1}' "$here/upstream.txt")

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git clone --quiet --filter=blob:none "$repo" "$tmp/la"
cd "$tmp/la"

head="$(git rev-parse HEAD)"
echo "pinned: $pin"
echo "now:    $head"
if [[ "$pin" == "$head" ]]; then
  echo "No upstream commits since the pin."
  exit 0
fi

changed="$(git log --format='%h %cs %s' "$pin..HEAD" -- "${cited[@]}")"
if [[ -z "$changed" ]]; then
  echo "Upstream has moved, but none of the cited pages changed."
  exit 0
fi
echo
echo "Commits since the pin that touched a cited page:"
echo "$changed"
echo
echo "Pages changed:"
git diff --stat "$pin" HEAD -- "${cited[@]}"
if [[ "${1:-}" == "--diff" ]]; then
  git diff "$pin" HEAD -- "${cited[@]}"
fi
