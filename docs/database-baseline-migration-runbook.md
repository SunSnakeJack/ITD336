# Baseline Database Migration and Recovery Runbook

## Scope

Migrations `0029`–`0031` are additive and must first be applied to a disposable local or dedicated test project. They must not be applied to production from this branch.

## Preflight

1. Confirm the target project reference and environment owner in writing.
2. Back up the database and record the latest migration/version identifiers.
3. Confirm migrations `0001`–`0028` match the target migration history.
4. Run a restore rehearsal in a non-production project.
5. Confirm `pgcrypto` and `btree_gist` are available.
6. Confirm the Northbkk SSO provider and role provisioning status; do not infer roles from email text.
7. Record row counts for `bookings`, `key_loans`, `room_keys`, `profiles`, and `audit_logs`.

## Sequence

1. Apply `0029_baseline_request_schema.sql` to add configuration and workflow tables.
2. Inspect the room-type classification update and correct test data through a new migration if necessary.
3. Apply `0030_baseline_workflow_functions.sql` and exercise each RPC using anonymous, user, admin, and service-role test actors.
4. Apply `0031_baseline_rls_and_compatibility.sql`; run the complete RLS actor matrix.
5. Run `supabase/tests/architecture.sql`, `v2_requirements.sql`, and `baseline_requirements.sql`.
6. Compare compatibility-view results with legacy key-loan history.
7. Observe locks, exclusion violations, outbox retries, and audit growth before application integration.

The email worker claims an outbox row with its stable `idempotency_key`, then calls `issue_key_request_action_bundle` in the delivery transaction. Raw action tokens are returned only in that service-role response and are never persisted. The provider request must use the outbox idempotency key. A crashed worker lease becomes claimable after 15 minutes; provider-side idempotency prevents a duplicate accepted delivery.

## Rollback and recovery

PostgreSQL migration history is forward-only for shared environments. Do not rewrite or delete an applied migration.

- Before application cutover, recovery is a new compensating migration that revokes new RPCs and disables their callers. Existing application paths remain intact.
- Preserve new request/history/audit rows. Do not drop tables merely to reverse a deployment.
- If a constraint causes unexpected rejection, ship a reviewed forward migration that narrows the constraint after preserving conflicting rows in a quarantine report.
- If outbox delivery misbehaves, revoke worker RPC execution and mark unclaimed jobs `CANCELLED` through an audited maintenance migration.
- If restoration is required, restore into a new project, validate row counts and RLS, then redirect traffic under an approved incident procedure.

## Not automated in this phase

- Production or cloud application of migrations.
- Northbkk SSO/provider configuration.
- Email worker/provider idempotency deployment and scheduler configuration.
- Daily 08:00 Asia/Bangkok automation deployment.
- Public identity dashboard activation.
- Generated TypeScript database-type regeneration.
