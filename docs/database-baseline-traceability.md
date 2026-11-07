# Approved Baseline Requirement Traceability

Status values: **Implemented** means represented by the migration design; **Implemented — NOT RUN** highlights runtime-sensitive enforcement that has only been statically reviewed because the local database runtime is unavailable; **Pending Decision** is deliberately gated; **Proposed Requirement** is documented but not activated; **Not Applicable to Database** belongs primarily to another layer. No database row below is a runtime pass claim.

## Functional requirements

| ID | Status | Database mapping / verification |
|---|---|---|
| FR-001 | Not Applicable to Database | QR routing is UI/deployment; shared `rooms` database retained. |
| FR-002 | Implemented | Existing `room_types`, `rooms`, equipment relations and active flags. |
| FR-003 | Implemented | Existing schedule RPCs plus key requests independent of class-schedule conflicts. |
| FR-004 | Implemented | `create_key_request`; only active key-request ranges conflict. |
| FR-005 | Implemented | 08:00–18:00 checks and baseline booking-rule values. |
| FR-006 | Implemented | Nullable `authenticated_user_id`; room-type `requires_sso_for_key_request`; RPC authorization. |
| FR-007 | Implemented | `room_types.usage_scope` isolates laboratory from meeting rooms. |
| FR-008 | Implemented | Key-request identity, purpose, course and lecturer constraints. |
| FR-009 | Implemented | Current Bangkok-day and service-hour validation in `create_key_request`. |
| FR-010 | Implemented — NOT RUN | `no_overlapping_active_key_requests` plus cross-legacy guards. |
| FR-011 | Implemented | `default_key_approval_mode='AUTO'` creates `APPROVED`. |
| FR-012 | Implemented | Special types require SSO and create `PENDING_APPROVAL`. |
| FR-013 | Implemented | `decide_key_request`, admin permission, decision actor/reason/time. |
| FR-014 | Partially Implemented | History is implemented; review screen is frontend work. |
| FR-015 | Partially Implemented | Idempotent outbox jobs are created; email renderer/worker is not deployed. |
| FR-016 | Implemented | Key request/history fields and compatibility view support filters/reporting. |
| FR-017 | Implemented | Hashed, expiring, single-use `CANCEL` token action. |
| FR-018 | Partially Implemented | Server roles supported; Northbkk provider/claim mapping remains external. |
| FR-019 | Implemented | Existing meeting booking permission model remains; no student elevation added. |
| FR-020 | Implemented | `usage_scope='MEETING'` provides the database discriminator. |
| FR-021 | Partially Implemented | Existing booking data supports dashboard; presentation is frontend work. |
| FR-022 | Implemented — NOT RUN | `create_meeting_booking` enforces configurable default 3, starts tomorrow, and skips Saturday. |
| FR-023 | Implemented | Existing booking exclusion/creation RPC remains authoritative. |
| FR-024 | Partially Implemented | `booking_segments` models surviving intervals; booking edit and availability integration is pending. |
| FR-025 | Pending Decision | Existing RPC blocks ended booking cancellation; changing it requires approved application compatibility work. |
| FR-026 | Implemented | Existing booking history plus `booking_segments`. |
| FR-027 | Implemented | Existing roles/user_roles/audit model supports administered Priority assignment. |
| FR-028 | Implemented — NOT RUN | `create_priority_booking_override` atomically supersedes, creates surviving bookings, and creates the priority booking. |
| FR-029 | Implemented — NOT RUN | Override requires authorized personnel plus `BOOKING_OVERRIDE` and rejects priority-on-priority. |
| FR-030 | Implemented — NOT RUN | Override retains origin links, audit data, segments, and an idempotent email job. |
| FR-031 | Implemented | Existing permission-checked Admin functions and RLS. |
| FR-032 | Not Applicable to Database | Queryable source data exists; dashboard composition and responsive counts are UI/query work. |
| FR-033 | Partially Implemented | Pending status and decision RPC implemented; Admin email/UI integration pending. |
| FR-034 | Implemented | Existing controlled room update RPCs retained; no destructive room deletion added. |
| FR-035 | Implemented | Existing schedule-management model; no new Admin table mutation grant. |
| FR-036 | Partially Implemented | `sync_runs`/impacts implemented; automation worker/schedule not deployed. |
| FR-037 | Partially Implemented | Schedule sync audit/impact schema implemented; importer not deployed. |
| FR-038 | Partially Implemented | Existing notifications and outbox foundation; external delivery integration pending. |
| FR-039 | Proposed Requirement | Outbox supports scheduling/idempotency; reminder producer job is not deployed. |
| FR-040 | Implemented — NOT RUN | Claim/complete RPCs, expiring leases, retry/dead state, schedule and provider idempotency contract. |
| FR-041 | Partially Implemented | Reporting fields/view exist; PDF/Excel/CSV generation is application work. |
| FR-042 | Implemented | Status histories, existing immutable audit log, sync impacts, controlled RPC audit events. |
| FR-043 | Implemented | Booking rules and per-room-type approval configuration avoid deployment-time constants. |
| FR-044 | Implemented — NOT RUN | Key ranges release on transitions; booking lifecycle trigger synchronizes segments. |
| FR-045 | Implemented — NOT RUN | Shared advisory locks, exclusion constraints and row locks cover new/legacy key requests and priority override. |
| FR-046 | Implemented | Request start is recorded; `RETURN` token records actual `returned_at`; no key copy required. |
| FR-047 | Implemented | Existing profiles/RBAC and audit model retained. |
| FR-048 | Partially Implemented | Profile linkage supported; SSO provider mapping not configured here. |
| FR-049 | Pending Decision | Required identity fields exist, but public view/grant is intentionally withheld for privacy confirmation. |
| FR-050 | Partially Implemented | RLS-protected announcements and request history exist; page/UI is outside database scope. |

## Non-functional requirements

| ID | Status | Database mapping / verification |
|---|---|---|
| NFR-001 | Not Applicable to Database | Responsive UI and accessibility are frontend concerns. |
| NFR-002 | Implemented | Existing RBAC plus server-side permission checks and RLS. |
| NFR-003 | Pending Decision | Token digests and narrow access implemented; public full identity is gated. |
| NFR-004 | Implemented | Constraints plus RPC input validation; client validation remains separate. |
| NFR-005 | Implemented — NOT RUN | Exclusion constraints, shared advisory locks, row locks and idempotency keys; concurrency harness remains unexecuted. |
| NFR-006 | Implemented | All calendar rules explicitly use `Asia/Bangkok`; storage remains timestamptz. |
| NFR-007 | Proposed Requirement | Indexes added; target latency/availability requires environment load testing. |
| NFR-008 | Implemented | Scheduled retryable idempotent outbox; external provider monitoring pending deployment. |
| NFR-009 | Partially Implemented | Audit/history implemented; retention duration remains a policy decision. |
| NFR-010 | Proposed Requirement | Backup/restore runbook supplied; infrastructure schedule is not configured here. |
| NFR-011 | Implemented | Sync run status, counts, checksum metadata and impact records. |
| NFR-012 | Implemented | Room-type policy and booking rules provide configuration isolation. |

## Database test mapping

`supabase/tests/baseline_requirements.sql` verifies additive tables, RLS coverage, overlap and idempotency constraints, RPC presence, direct privilege denial, compatibility view presence, and preservation of legacy key tables. Behavioral concurrency and actor tests require a running disposable Supabase database and test identities.
