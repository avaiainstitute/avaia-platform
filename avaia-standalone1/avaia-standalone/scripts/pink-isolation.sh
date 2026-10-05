#!/bin/sh
# Build-time guard: AVAIA's code must not touch The Pink Shoelace Foundation.
#
# The Foundation is a separate organization with its own application, database and deployment
# (repository avaiainstitute/pink-shoelace-foundation-app; Founder directive 2026-10-05). Its
# tables still exist in AVAIA's database as preserved history (docs/pink/DATA.md) but nothing here
# may read or write them. This fails the build if any AVAIA source file
#   - reads or writes a pink_* table, or
#   - imports Foundation code (@/lib/pink/...).

set -u
SRC="app lib components"

BAD="$(grep -rnE -e '.from\("pink_' -e "\.from\('pink_" -e '@/lib/pink/' -e '@/app/pink-admin' $SRC --include='*.ts' --include='*.tsx' 2>/dev/null)"
if [ -n "$BAD" ]; then
  echo "Pink/AVAIA separation violated. AVAIA code touches the Foundation's tables or code:" >&2
  echo "$BAD" >&2
  exit 1
fi

echo "Pink/AVAIA separation holds: no AVAIA file reads or writes a Foundation table or imports Foundation code."
