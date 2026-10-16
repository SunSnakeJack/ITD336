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

-- Sources: 0001, 0005, 0013–0014, 0022–0023, 0026.

-- Configuration tables
-- booking_rules(rule_key, rule_value jsonb, description, active, updated_by, updated_at)
-- system_settings(setting_key, setting_value jsonb, ...)
-- holidays(holiday_date, name, booking_allowed, notes)
-- room_usage_policies(room_id, policy jsonb, updated_by, updated_at)

-- Global usage policy API (0022)
-- public.get_usage_permission_policy()
-- public.update_usage_permission_policy(jsonb)
-- The global policy remains for compatibility; per-room policy from 0023 is the
-- canonical current matrix for managed room behavior.

-- Per-room policy API (0023)
-- public.get_room_usage_policy(uuid)
-- public.update_room_usage_policy(uuid,jsonb)
-- Only SETTINGS_MANAGE callers can read/update the admin policy interface. Runtime
-- booking/key functions consume policy values database-side.

-- Important seeded rule keys observed across migrations:
-- MAX_ADVANCE_BOOKING_DAYS, GENERAL_OPEN_TIME, GENERAL_CLOSE_TIME,
-- ADVANCE_BOOKING_INTERPRETATION and usage-permission policy JSON.
-- 0026 sets GENERAL_CLOSE_TIME to "18:30".

-- Room-type configuration (0005): booking_policy AUTO_CONFIRM/MANUAL_APPROVAL and
-- student_booking_allowed. Later per-room rules can further restrict student booking
-- and key use. Conflicts are resolved by the latest consuming function definitions,
-- principally 0020 and 0023–0025.

-- Security: direct configuration table mutation is limited by grants/RLS; update RPCs
-- require SETTINGS_MANAGE and create audit records.

-- UNVERIFIED: JSON schema is enforced procedurally rather than by a JSON Schema
-- constraint. Existing remote rows may differ from seeds if administrators changed them.

