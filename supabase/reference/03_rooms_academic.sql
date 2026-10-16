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

-- Sources: 0001, 0005, 0006, 0008–0018, 0020, 0023, 0026.

-- Canonical entities
-- room_types controls booking_policy and student_booking_allowed (0005).
-- rooms includes code/name/type/building/floor/capacity, active, booking_enabled,
-- academic schedule confirmation fields (0008), and unique layout_key (0018).
-- class_schedules supports recurring weekly CLASS/ADMIN_ALLOCATION records with
-- day_of_week, start_time/end_time, effective date range, status and teacher.
-- academic_terms stores named term ranges and one active term flag (0014).
-- room_blocks and room_operating_hours provide exceptional and weekly availability.

-- Latest public catalog API (0023 replaces 0011, 0013 and 0018 definitions):
-- public.get_public_room_catalog()
-- Returns active room identity, presentation/layout fields and booking availability.

-- Latest public schedule API (0023 replaces 0011 and 0020 definitions):
-- public.get_public_room_schedule_events(uuid,date,date)
-- Combines privacy-safe class/booking/block events for anon/authenticated callers.

-- Authenticated/admin schedule APIs:
-- public.get_room_schedule_events(uuid,date,date)            -- 0008
-- public.set_room_schedule_confirmation(uuid,boolean)        -- 0008
-- public.upsert_academic_schedule(...)                       -- 0008
-- public.deactivate_academic_schedule(uuid,text)              -- 0008
-- public.find_academic_schedule_conflict(...)                 -- 0015
-- public.upsert_academic_term(uuid,text,text,date,date,boolean)-- 0014
-- public.set_room_availability(uuid,boolean)                  -- 0012
-- public.update_room_details(uuid,text,integer,boolean)       -- 0016 (legacy)
-- public.update_room_details_v2(uuid,text,text,integer,boolean)-- 0018 (current UI)

-- Availability engines
-- public.check_room_availability(...) latest definition: 0017_external_booking_edit.sql.
-- It covers booking, recurring schedule occurrences and room blocks, while redacting
-- protected descriptions according to caller permissions.
-- public.list_public_room_availability(...) originates in 0007.
-- public.list_available_rooms(...) originates in 0002 and relies on the replaced
-- check_room_availability implementation at runtime.

-- Triggers
-- reject_closed_weekday_schedule (0013): rejects schedule writes on configured closed day.
-- set_class_schedules_updated_at (0008); set_academic_terms_updated_at (0014).

-- Indexes
-- class_schedules_room_time_idx (0003), class_schedules_type_status_time_idx (0007),
-- class_schedules_recurring_lookup_idx (0008), room_blocks_room_time_idx (0003).

-- 0026 changes GENERAL_CLOSE_TIME to "18:30" through booking_rules seed/update data.
-- This is runtime configuration data, not a hard-coded database type constraint.

-- UNVERIFIED: actual room rows, current term, confirmation flags and rule values are
-- data-dependent; this reference describes only definitions and seeded intent.

