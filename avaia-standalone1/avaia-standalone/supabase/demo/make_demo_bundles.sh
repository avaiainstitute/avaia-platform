#!/bin/sh
# Regenerates the ordered SQL bundles that build the DEMO database (the separate Supabase project "avaia-demo"). Writes nothing to the
# database and contains no secrets. Run from anywhere inside the repository:
#
#     sh supabase/demo/make_demo_bundles.sh /some/empty/output/folder
#
# WHY IT REPLAYS HISTORY: Production was not built by running today's supabase/schema.sql plus every migration. Today's schema.sql is a
# fresh-install reference that already contains most of what the migrations add (so running both makes the database try to create things
# twice) and it refers to some tables before it creates them. Production was built the other way: the ORIGINAL schema.sql (commit 0daeb87,
# 2026-07-25, five tables) and then each migration in order. This script rebuilds exactly that sequence, unmodified, with one comment-marker
# restoration in migration 0007 (see docs/demo/DEMO_DATABASE_BUILD_NOTES.md).
#
# After the nine bundles: run supabase/demo/bundle_supplement_gpt_handoff_sessions.sql, then supabase/demo/demo_align_with_production.sql,
# then verify with demo_schema_parity_check.sql and demo_snapshot_fingerprint.sql (the fingerprint must equal Production's).

set -eu
OUT="${1:-}"
if [ -z "$OUT" ]; then echo "usage: sh supabase/demo/make_demo_bundles.sh <output folder>" >&2; exit 2; fi
mkdir -p "$OUT"

ROOT="$(git rev-parse --show-toplevel)"
APP="avaia-standalone1/avaia-standalone"
SB="$APP/supabase"
ORIGINAL_SCHEMA_COMMIT="0daeb87"
LIMIT=105000
SHA="$(git -C "$ROOT" rev-parse --short HEAD)"

emit() {
  case "$1" in
    SCHEMA0) git -C "$ROOT" show "$ORIGINAL_SCHEMA_COMMIT:$SB/schema.sql" ;;
    migrations/0007_journeys_backfill.sql)
      # The site-wide punctuation cleanup of 2026-09-10 (commit 307ba01) turned one SQL comment marker into a comma. Restore it.
      git -C "$ROOT" show "HEAD:$SB/$1" | sed 's/^      continue;, source conversation/      continue; -- source conversation/' ;;
    *) git -C "$ROOT" show "HEAD:$SB/$1" ;;
  esac
}
size_of() {
  case "$1" in
    SCHEMA0) git -C "$ROOT" show "$ORIGINAL_SCHEMA_COMMIT:$SB/schema.sql" | wc -c ;;
    *) git -C "$ROOT" cat-file -s "HEAD:$SB/$1" ;;
  esac
}

FILES="SCHEMA0 $(git -C "$ROOT" ls-files "$SB/migrations" | sed "s#^$SB/##" | sort | tr '\n' ' ')"

# Group the files into bundles of at most LIMIT bytes, never splitting a file.
GROUPS_FILE="$OUT/.groups.tmp"
: > "$GROUPS_FILE"
cur=""; size=0
for f in $FILES; do
  s="$(size_of "$f")"
  if [ -n "$cur" ] && [ $((size + s)) -gt $LIMIT ]; then echo "$cur" >> "$GROUPS_FILE"; cur=""; size=0; fi
  cur="$cur $f"; size=$((size + s))
done
echo "$cur" >> "$GROUPS_FILE"

total="$(wc -l < "$GROUPS_FILE" | tr -d ' ')"
i=0
while IFS= read -r g; do
  i=$((i + 1))
  nn="$(printf '%02d' "$i")"; tt="$(printf '%02d' "$total")"
  out="$OUT/bundle_${nn}_of_${tt}.sql"
  last="$(echo "$g" | awk '{print $NF}')"
  {
    echo "-- AVAIA DEMO DATABASE BUILD (history replay), bundle $i of $total. Source: repository commit $SHA."
    echo "-- First file is the ORIGINAL schema.sql (commit $ORIGINAL_SCHEMA_COMMIT, 2026-07-25), then the migrations in order, as Production was built."
    echo "-- Files here are byte-for-byte the committed ones, except one comment-marker restoration in migration 0007 (see docs/demo/DEMO_DATABASE_BUILD_NOTES.md)."
    echo "-- If ANY statement errors: STOP. Do not run the next bundle. Send the error text back."
    echo
    for f in $g; do
      if [ "$f" = "SCHEMA0" ]; then echo "-- ===== FILE: schema.sql (original, commit $ORIGINAL_SCHEMA_COMMIT) ====="; else echo "-- ===== FILE: $f ====="; fi
      emit "$f"
      echo
    done
    echo "select 'BUNDLE $i OF $total FINISHED: last file $last' as build_status;"
  } > "$out"
  echo "bundle $i: $(echo "$g" | wc -w | tr -d ' ') files, $(wc -c < "$out" | tr -d ' ') bytes"
done < "$GROUPS_FILE"
rm -f "$GROUPS_FILE"
echo "Wrote $total bundles to $OUT"
