#!/usr/bin/env bash
# Applies every migration to a throwaway local Postgres (15+) and runs the SQL
# scenario tests. Never point this at Supabase.
#
#   PGHOST=localhost PGPORT=54329 PGUSER=postgres migrations/tests/run-local.sh
#
# It drops and recreates the database named by TEST_DB (default gzad_test).
set -euo pipefail

cd "$(dirname "$0")/.."
DB="${TEST_DB:-gzad_test}"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"

for f in tests/supabase_stub.sql 0*.sql; do
  echo "== $f"
  PGOPTIONS='-c client_min_messages=warning' "${PSQL[@]}" -d "$DB" -f "$f"
done

# New forward changes use the Supabase CLI's timestamped migration location.
for f in ../supabase/migrations/*.sql; do
  [ -e "$f" ] || continue
  echo "== $f"
  PGOPTIONS='-c client_min_messages=warning' "${PSQL[@]}" -d "$DB" -f "$f"
done

# Migrations from 009 on must be safe to re-run (001 never was).
for f in 009_*.sql 01*.sql; do
  [ -e "$f" ] || continue
  "${PSQL[@]}" -d "$DB" -f "$f" > /dev/null 2>&1 || { echo "re-run failed: $f"; exit 1; }
done
for f in ../supabase/migrations/*.sql; do
  [ -e "$f" ] || continue
  "${PSQL[@]}" -d "$DB" -f "$f" > /dev/null 2>&1 || { echo "re-run failed: $f"; exit 1; }
done
echo "== re-run of 009+: ok"

for f in tests/*_scenarios.sql; do
  [ -e "$f" ] || continue
  echo "== $f"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

echo
echo "End-to-end pipeline test (optional):"
echo "  BILLING_PG_URL=postgres://\${PGUSER:-postgres}@\${PGHOST:-localhost}:\${PGPORT:-5432}/$DB npx vitest run src/lib/metering.e2e.test.ts"
