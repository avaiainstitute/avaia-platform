#!/bin/sh
# Build-time guard (runs before every build, see package.json "prebuild").
#
# The evaluator-only certification reference (lib/certification-evaluator-reference.ts:
# Boundary Gate pass standards and retraining paths, Practicum "what to watch for",
# lab evaluator checks) may be imported ONLY from admin evaluation screens under
# app/admin/. The Companion, the AI Host practice, the classroom pages and every other
# candidate-facing surface must never be able to read it. The one other permitted importer is
# the System Checks self-test (lib/ops/certification-selftests.ts), which only proves the
# separation holds. If any other file imports it
# the build fails here, before anything ships.
#
# POSIX sh + grep only. Only real import statements count (a comment that names the
# file is fine).

set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PATTERN='(from|import[(]) *["'"'"'][^"'"'"']*certification-evaluator-reference'

BAD="$(grep -rlE "$PATTERN" app lib components --include='*.ts' --include='*.tsx' 2>/dev/null \
  | grep -v '^lib/certification-evaluator-reference.ts$' \
  | grep -v '^lib/ops/certification-selftests.ts$' \
  | grep -v '^app/admin/' || true)"

if [ -n "$BAD" ]; then
  echo "Evaluator isolation violated. These files import the evaluator-only reference but are not admin screens:" >&2
  echo "$BAD" >&2
  exit 1
fi
echo "Evaluator isolation holds: the evaluator-only reference is imported only by admin screens."
