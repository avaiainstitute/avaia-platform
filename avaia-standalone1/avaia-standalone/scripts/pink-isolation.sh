#!/bin/sh
# Build-time guard (runs before every build, see package.json "prebuild").
#
# The Pink Shoelace Foundation and AVAIA are separate organizations (Founder directive,
# 2026-10-05). Until the Foundation has its own project (see docs/pink/SEPARATION.md), its code
# lives in this repository, so this guard keeps the line between the two from being crossed by
# accident. It fails the build if either side reaches across.
#
#   RULE A  Nothing outside the Foundation's own files may read or write a Foundation table
#           (.from("pink_...")) or import the Foundation's code (@/lib/pink/...).
#           AVAIA's operations, digest, admin, journeys and every other AVAIA file are covered.
#   RULE B  The Foundation's own files may import only the shared pieces listed below, and read
#           only the tables listed below. The list may shrink (as the Foundation is extracted);
#           growing it means a new dependency between the organizations, which needs a decision.
#
# POSIX sh + grep only. Only real code counts (a comment that names a table is fine).

set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Files that belong to the Foundation, or that are shared screens/utilities tested separately
# (lib/ops/pink-separation-selftests.ts proves the AVAIA side of each shared screen).
OWNED_OR_SHARED='^(app/pink-admin/|app/api/pink/|app/api/cron/pink-daily-summary/|lib/pink/|lib/admin-views/InquiriesView.tsx|lib/admin-views/OpportunitiesView.tsx|lib/admin-scope.ts|lib/research/prospect-research.ts|lib/ops/system-checks.ts|lib/ops/system-truth.ts|lib/ops/expected-schema.generated.ts|lib/ops/pink-separation-selftests.ts)'

# RULE A
BAD_A="$(grep -rlE '\.from\("pink_|from "@/lib/pink/|from "@/app/pink-admin' app lib components --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -vE "$OWNED_OR_SHARED" || true)"
if [ -n "$BAD_A" ]; then
  echo "Pink/AVAIA separation violated (rule A). These files touch the Foundation's tables or code but are not Foundation files:" >&2
  echo "$BAD_A" >&2
  exit 1
fi

# RULE B, imports
ALLOWED_IMPORTS='@/lib/admin-views/ContentView @/lib/admin-views/InquiriesView @/lib/admin-views/NotesView @/lib/admin-views/OpportunitiesView @/lib/engine/anthropic @/lib/ops/cron-auth @/lib/ops/cron-runs @/lib/ops/needs-dorian-core @/lib/ops/system-checks @/lib/resend @/lib/supabase/admin @/lib/supabase/server'
OWNED_DIRS='app/pink-admin app/api/pink app/api/cron/pink-daily-summary lib/pink'
FOUND="$(grep -rhoE 'from "@/[^"]+"' $OWNED_DIRS --include='*.ts' --include='*.tsx' 2>/dev/null | sed -E 's/^from "(.*)"$/\1/' | sort -u)"
for imp in $FOUND; do
  case "$imp" in
    @/lib/pink/*) continue ;;
  esac
  case " $ALLOWED_IMPORTS " in
    *" $imp "*) ;;
    *) echo "Pink/AVAIA separation violated (rule B). A Foundation file imports $imp, which is not on the shared list in scripts/pink-isolation.sh." >&2; exit 1 ;;
  esac
done

# RULE B, tables
ALLOWED_TABLES='avaia_content_items email_send_failures founder_notes profiles system_check_results'
TABLES="$(grep -rhoE '\.from\("[a-z_0-9]+"\)' $OWNED_DIRS --include='*.ts' --include='*.tsx' 2>/dev/null | sed -E 's/^\.from\("(.*)"\)$/\1/' | sort -u)"
for t in $TABLES; do
  case "$t" in
    pink_*) continue ;;
  esac
  case " $ALLOWED_TABLES " in
    *" $t "*) ;;
    *) echo "Pink/AVAIA separation violated (rule B). A Foundation file reads the table $t, which is not on the shared list in scripts/pink-isolation.sh." >&2; exit 1 ;;
  esac
done

echo "Pink/AVAIA separation holds: no AVAIA file touches a Foundation table or code, and the Foundation's shared dependencies have not grown."
