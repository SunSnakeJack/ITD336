# Staff Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an ADMIN-protected, responsive `/staff` management area with 16 routed screens and honest integration status.

**Architecture:** Add a self-contained `src/features/staff` feature and reuse existing TanStack queries for rooms, bookings, and keys. Keep unsupported mutations visible but disabled with backend dependency explanations.

**Tech Stack:** React 19, React Router 7, TypeScript, TanStack Query, Vitest/RTL, existing CSS design tokens

**Spec:** `docs/superpowers/specs/2026-11-12-staff-management-design.md`

## Global Constraints

- Do not change backend, database, migrations, Edge Functions, RLS, auth, or permissions.
- Do not commit, push, or deploy.
- Preserve all pre-existing uncommitted changes.
- Use only real data returned by existing services; never present mock data as real.

## Review Focus

- A non-ADMIN visitor must never render staff content.
- Every required route must resolve under the staff shell.
- A narrow viewport must use a dismissible drawer without page-level horizontal overflow.
- Empty/error query results must remain understandable and must not leak backend details.
- Unsupported write operations must not expose an active mutation control.

---

### Task 1: Staff route contract and navigation

**Files:**
- Create: `src/features/staff/staff-navigation.ts`
- Create: `src/features/staff/staff-navigation.test.ts`
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:** Produces `staffNavigation` and all 16 route registrations protected by `AdminGuard`.

- [ ] Write failing navigation and route tests.
- [ ] Run targeted tests and confirm missing staff feature failures.
- [ ] Add route metadata and route registrations.
- [ ] Run targeted tests and confirm pass.

### Task 2: Responsive staff shell and shared states

**Files:**
- Create: `src/features/staff/components/StaffLayout.tsx`
- Create: `src/features/staff/components/StaffPage.tsx`
- Create: `src/features/staff/staff.css`
- Test: `src/features/staff/components/StaffLayout.test.tsx`

**Interfaces:** Produces responsive sidebar/drawer, topbar, breadcrumbs, page header, status badges, query-state and limitation panels.

- [ ] Write failing shell interaction test.
- [ ] Confirm RED, implement minimal shell, confirm GREEN.

### Task 3: Overview and room screens

**Files:**
- Create: `src/features/staff/pages/StaffOverviewPages.tsx`
- Test: `src/features/staff/pages/StaffOverviewPages.test.tsx`

**Interfaces:** Consumes `roomsQuery`; produces home, room list, room detail, and settings screens.

- [ ] Test room filtering and empty states first.
- [ ] Implement the four screens with real query data.
- [ ] Run targeted tests.

### Task 4: Management and history screens

**Files:**
- Create: `src/features/staff/pages/StaffManagementPages.tsx`
- Create: `src/features/staff/pages/StaffHistoryPages.tsx`
- Test: `src/features/staff/pages/staff-data.test.tsx`

**Interfaces:** Consumes existing booking/key/room queries; produces users, user form, key request list/detail, meeting room list/form, and two history screens.

- [ ] Write failing data-state tests.
- [ ] Implement searchable/filterable real-data tables and explicit backend limitation screens.
- [ ] Run targeted tests.

### Task 5: Dashboards and reports

**Files:**
- Create: `src/features/staff/pages/StaffDashboardPages.tsx`
- Create: `src/features/staff/pages/StaffReportPages.tsx`
- Create: `src/features/staff/utils/staff-analytics.ts`
- Test: `src/features/staff/utils/staff-analytics.test.ts`

**Interfaces:** Produces deterministic KPI aggregation, two dashboards, two filtered reports, and print-to-PDF actions.

- [ ] Write failing analytics tests with fixed inputs.
- [ ] Implement aggregation and pages using only query results.
- [ ] Run targeted tests.

### Task 6: Verification and responsive QA

**Files:**
- Modify only files required by evidence from checks.

- [ ] Run staff targeted tests.
- [ ] Run `npm run typecheck`, `npm run test`, `npm run lint`, and `npm run build`.
- [ ] Run `git diff --check` and review `git status` without changing unrelated work.
- [ ] Inspect 320, 375, 430, 768, 1024, and 1440px layouts if a local browser is available; report exact coverage.

