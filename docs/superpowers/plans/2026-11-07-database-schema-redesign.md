# ITD336 Baseline Database Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a review-ready, non-destructive Supabase schema supporting the approved database-relevant FR/NFR baseline.

**Architecture:** Preserve existing tables and introduce a request-centric key workflow, segmented priority bookings, hashed action tokens, an idempotent notification outbox, and synchronization audit records. Expose mutations only through narrow RPCs and retain a compatibility view for legacy data.

**Tech Stack:** PostgreSQL, Supabase Auth/RLS, PL/pgSQL, pgTAP-style structural SQL assertions, Mermaid.

**Spec:** `docs/superpowers/specs/2026-11-07-database-schema-redesign-design.md`

## Global Constraints

- Do not apply migrations to production or any unidentified cloud project.
- Do not remove or rewrite existing migrations, `room_keys`, or `key_loans`.
- Do not edit frontend/backend application code or generated database types.
- Service hours are 08:00–18:00 in `Asia/Bangkok`.
- Public full-name/email access remains disabled pending privacy confirmation.

## Review Focus

- Concurrent overlapping pending key requests must produce at most one success.
- Anonymous callers must not create special-room requests or read workflow tables.
- An expired or previously consumed token must not mutate a request.
- Partial priority override must retain both unaffected intervals when applicable.
- Retried delivery claiming must not produce duplicate successful email deliveries.

---

### Task 1: Baseline request schema

**Files:**
- Test: `supabase/tests/baseline_requirements.sql`
- Create: `supabase/migrations/0029_baseline_request_schema.sql`

**Interfaces:**
- Produces: `key_requests`, histories, tokens, outbox, booking segments, sync records, announcements, and room-type configuration.

- [ ] Write structural assertions for tables, constraints, indexes, RLS, and non-destructive compatibility.
- [ ] Run the SQL test against a disposable local database and observe the missing-object failure when available.
- [ ] Add the tables, constraints, indexes, configuration, and RLS enablement.
- [ ] Re-run structural validation.

### Task 2: Transactional workflow RPCs

**Files:**
- Modify: `supabase/tests/baseline_requirements.sql`
- Create: `supabase/migrations/0030_baseline_workflow_functions.sql`

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: request creation/decision/cancellation/return, token consumption, booking segmentation, and outbox claim RPCs.

- [ ] Add behavioral and function-security assertions first.
- [ ] Observe the missing-function failure when a disposable database is available.
- [ ] Implement locked and permission-checked RPCs with explicit `search_path`.
- [ ] Re-run database validation.

### Task 3: RLS and compatibility surfaces

**Files:**
- Modify: `supabase/tests/baseline_requirements.sql`
- Create: `supabase/migrations/0031_baseline_rls_and_compatibility.sql`

**Interfaces:**
- Consumes: Task 1 schema and Task 2 RPCs.
- Produces: least-privilege policies, grants, and `key_request_history_compat_v`.

- [ ] Add actor-matrix and privilege assertions first.
- [ ] Observe missing policies/grants in a disposable database when available.
- [ ] Add RLS policies, revoke direct mutation, grant narrow RPC execution, and add compatibility view.
- [ ] Re-run database validation.

### Task 4: Review documentation and traceability

**Files:**
- Create: `docs/database-baseline-erd.md`
- Create: `docs/database-baseline-traceability.md`
- Create: `docs/database-baseline-migration-runbook.md`
- Modify: `docs/pending-requirements.md`

**Interfaces:**
- Consumes: final schema/RPC names from Tasks 1–3.
- Produces: ERD, 62-row traceability, migration/rollback sequence, privacy risk, and PM decisions.

- [ ] Map every FR/NFR to database artifacts, tests, or a non-database/pending status.
- [ ] Document preflight, staged application, observation, and forward-recovery steps.
- [ ] Check all documented identifiers against migration text.

### Task 5: Verification

**Files:**
- Modify: documentation only if verification exposes a documented limitation.

**Interfaces:**
- Consumes: all deliverables.
- Produces: evidence-backed completion report.

- [ ] Run local database reset/tests when the runtime is available; otherwise record the exact blocker.
- [ ] Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Review `git status`, migration ordering, and the complete diff for secrets or unrelated files.
