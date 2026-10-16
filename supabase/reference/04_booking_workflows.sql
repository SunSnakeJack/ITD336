-- =====================================================
-- ITD336 DATABASE REFERENCE
-- REFERENCE ONLY — NOT A MIGRATION
-- DO NOT EXECUTE OR DEPLOY
-- =====================================================
--
-- Purpose: Developer documentation and SQL reference.
-- Source: Existing Supabase migration files.
-- This file is not used for database deployment.
-- =====================================================

-- Sources: 0001–007, 0017, 0019–0020, 0022–0023, 0025, 0027.

-- Core tables: bookings, booking_approvals, booking_status_history.
-- Current status values include PENDING, APPROVED, REJECTED, CANCELLED, IN_USE,
-- COMPLETED, NO_SHOW and SUPERSEDED.

-- Latest effective workflow functions
-- public.create_booking(...)                 -- 0020 (replaces 0002 and 0006)
-- public.approve_booking(uuid,text)          -- 0002
-- public.reject_booking(uuid,text)           -- 0002
-- public.cancel_booking(uuid,text)           -- 0027 (replaces 0002)
-- public.reconcile_expired_bookings()        -- 0027
-- public.create_external_booking(...)        -- 0006
-- public.get_external_booking_for_edit(uuid) -- 0017
-- public.update_external_booking(...)        -- 0017
-- public.override_booking(...)               -- 0006

-- Current create_booking behavior (0020): authenticated role and room policy checks,
-- future valid range, configurable advance/open/close rules, advisory room lock,
-- authoritative conflict check, status/history/audit/notification insertion.

-- Conflict protection is layered:
-- 1) public.check_room_availability latest in 0017;
-- 2) no_overlapping_active_bookings GiST exclusion for APPROVED/IN_USE;
-- 3) prevent_duplicate_pending_lab_booking trigger (0019);
-- 4) enforce_managed_lab_booking_policy (latest 0023) on insert;
-- 5) enforce_student_booking_management_policy (0023) on status update.

-- Expiry lifecycle (0027):
-- public.reconcile_expired_bookings() changes elapsed APPROVED or IN_USE rows to
-- COMPLETED, writes status history and audit events. public.cancel_booking rejects a
-- cancellation once ends_at <= now(). This reconciliation is invocation-driven;
-- no pg_cron schedule is defined in migrations.

-- Views: booking_details_v (latest 0007), user_booking_history_v,
-- staff_pending_bookings_v and booking_report_v.

-- Superseded definitions:
-- create_booking from 0002/0006; check_room_availability from 0002/0006;
-- cancel_booking from 0002. Keep historical migrations unchanged; use the later
-- CREATE OR REPLACE definition as canonical.

-- UNVERIFIED: whether an elapsed booking has already become COMPLETED depends on a
-- caller having invoked reconciliation and on remote runtime data.

