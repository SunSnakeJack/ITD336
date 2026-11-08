# Key Request Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the mobile-first laboratory key-request journey shown in the approved references, backed by Supabase data and the existing secure request RPC.

**Architecture:** Keep the feature-driven flow under `src/features/keys`: catalog, room detail/time selection, authentication gate, shared form, review, and result. Public reads use controlled RPCs; request creation remains database-controlled. Add migration `0033` for idempotent room/equipment seed data and public detail data without rewriting migration `0032`.

**Tech Stack:** React 19, React Router, TanStack Query, TypeScript, Supabase/PostgreSQL, Vitest/Testing Library, Tailwind-compatible project CSS.

**Spec:** Approved chat design based on reference images 1–11 (2026-11-08).

## Global Constraints

- General laboratories allow anonymous requests with an exact `@northbkk.ac.th` email.
- Special laboratories require Google SSO and admin approval; identity fields are read-only and auto-filled.
- Requests are Sunday–Friday, 08:00–18:00; Saturday is visible but unavailable.
- Database constraints/RPCs remain authoritative for conflicts and authorization.
- Do not apply migrations to Supabase Cloud without separate approval.
- Do not modify or commit the existing dirty `package-lock.json` or `.env`.

## Review Focus

- A direct special-room URL must not bypass SSO.
- A forged university-like domain must not pass validation.
- Occupied and Saturday slots must not be selectable.
- Selection must survive the special-room OAuth round trip.
- Concurrent requests must still be rejected by the database constraint.

---

### Task 1: Catalog and room detail contracts

**Files:** Modify schedule types/service and key queries; add room-detail types/service tests.

- [ ] Add failing mapping tests for catalog metadata and detail RPC data.
- [ ] Implement typed catalog/detail mapping and stable query keys.
- [ ] Run focused and full tests.

### Task 2: Mobile catalog and detail/time-selection UI

**Files:** Modify `KeyRequestRoomsPage.tsx`, add `KeyRequestRoomDetailPage.tsx`, supporting components/utils, routes, and CSS.

- [ ] Add failing behavior tests for tabs, detail navigation, unavailable slots, and general/special actions.
- [ ] Implement the approved responsive catalog and detail screens.
- [ ] Run focused and full tests.

### Task 3: SSO, form, review, and result journey

**Files:** Modify auth service and key form pages/components.

- [ ] Add failing tests for Google SSO, return URL, auto-fill, review, approved and pending results.
- [ ] Implement modal auth gate and shared form journey.
- [ ] Run focused and full tests.

### Task 4: Migration 0033 and database verification

**Files:** Add `0033_key_request_room_experience.sql`; extend Supabase SQL tests.

- [ ] Add structural/behavior assertions first.
- [ ] Add idempotent room/equipment seed and least-privilege detail RPC.
- [ ] Run SQL structural checks available locally; do not push Cloud.

### Task 5: Final verification

- [ ] Run `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Review the complete diff for secrets, unrelated files, and database safety.
