# Requirements V2 — Validation and Migration Safety Report

วันที่ตรวจ: 12 ตุลาคม 2026 (Asia/Bangkok)

## Validation results

| Check | Result | Evidence / limitation |
|---|---|---|
| Existing migrations inspected | PASS | อ่าน `0001`–`0004`, seed, SQL tests, services, types และ docs |
| Incremental migration ordering | PASS | เพิ่มเฉพาะ `0005`–`0007`; ไม่แก้ `0001`–`0004` |
| Static security review | PASS | V2 `SECURITY DEFINER` functions มี fixed empty `search_path`, permission checks และ explicit grants |
| TypeScript | PASS | `npm run typecheck` |
| ESLint | PASS | `npm run lint` |
| Production build | PASS | `npm run build` |
| Vitest | FAIL | Existing `src/App.test.tsx` expects English heading while current `src/App.tsx` renders Thai; unrelated to database changes |
| Local database connection | BLOCKED | `127.0.0.1:54322` refused; Docker daemon/Supabase local stack unavailable |
| Migration execution | NOT RUN | No disposable PostgreSQL runtime; remote execution prohibited |
| SQL database tests | NOT RUN | Requires migrations on a disposable database |
| Auth/RLS persona tests | NOT RUN | AUTH TEST USERS REQUIRED and schema is not locally applied |
| Concurrent booking/key tests | NOT RUN | Multi-session local database unavailable |
| Generated DB types | NOT RUN | Must regenerate only after V2 schema is applied to an approved development database |

## Migration safety

- Preserved: all 27 existing tables, records, foreign keys, booking exclusion protection, audit/history data, and existing RPC names.
- Added: one normalized `external_parties` table, additive columns/enums, V2 RPCs, sanitized Guest availability, reporting views, and indexes.
- Backfilled: booking actor/beneficiary fields and key-loan room/requesting actor fields from existing rows.
- Changed safely: STAFF role-permission mappings; special-room policies; active-key uniqueness index definition; views are transactionally dropped/recreated under the same names.
- No production/remote database command was run.
- No commit, push, or deployment was performed.

## Compatibility risks

1. `database.types.ts` still describes the currently deployed V1 schema. Regenerate after an approved V2 migration application; do not edit it manually.
2. Legacy `request_key`, `approve_key_request`, and `checkout_key` remain for compatibility, but `borrow_key` is the intended V2 path.
3. View definitions retain existing names but add V2 fields; consumers selecting explicit columns remain safest.
4. Existing `0004_verify_foundation.sql` depends on seed counts before the standard seed phase, which can block a clean reset. Do not rewrite it without an approved migration-history repair plan.
5. Enum additions are forward-compatible but not trivially reversible. Recovery should use backup/PITR or a reviewed forward migration.
6. Existing accounts assigned only `STAFF` intentionally lose administrative permissions. No user is auto-promoted to `ADMIN`; intended administrators must be assigned the new role through a trusted administrative process after review.

## Required approval gate before Cloud migration

1. Resolve the `0004` clean-environment issue without rewriting applied history.
2. Run `0005`–`0007` on a disposable database restored from representative V1 data.
3. Execute `supabase/tests/architecture.sql` and `supabase/tests/v2_requirements.sql`.
4. Create Guest, Student, Teacher, Priority, Staff, and Admin Auth fixtures and run RLS/RPC tests.
5. Run two-session booking override and key checkout races.
6. Review V2 SQL and the pending business decisions with the product owner.
7. Only then dry-run against the explicitly identified development project and request separate authorization to apply.
