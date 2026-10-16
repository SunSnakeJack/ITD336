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

-- Sources: 0001–007, 0019–0025.

-- Tables: room_keys, key_loans, key_loan_history, key_incidents,
-- key_compensations. A key loan can originate from BOOKING, CLASS_SCHEDULE or
-- DIRECT_USAGE. Physical key_id is nullable for room-level workflow records.

-- Latest user-facing functions
-- public.request_booking_key(uuid,text)              -- 0025 (replaces 0019/0023)
-- public.request_class_key(uuid,uuid,timestamptz,
--                          timestamptz,text)          -- 0023
-- public.report_key_status(uuid,text,text)            -- 0024 (replaces 0021)
-- public.report_key_issue(uuid,text,text)             -- 0020
-- public.report_key_damage(uuid,text)                 -- 0019

-- General/legacy management functions
-- public.request_key(uuid)                            -- 0006 replacement
-- public.borrow_key(...)                              -- 0006
-- public.confirm_key_return(uuid,timestamptz,text)    -- 0006
-- public.return_key(uuid,text,text)                   -- 0006
-- public.approve_key_request(uuid,text)               -- 0002
-- public.checkout_key(uuid,uuid,timestamptz)          -- 0002

-- Self-service lifecycle (latest intent): 0025 approves the eligible booking-key
-- request directly; 0024 makes a valid user return immediately RETURNED and releases
-- the physical room key to AVAILABLE. Admin return confirmation is not required.

-- Concurrency and date enforcement
-- enforce_single_room_key_holder trigger (0024) prevents simultaneous CHECKED_OUT/LATE
-- room-level holders. enforce_key_checkout_date (0023) prevents checkout before an
-- eligible booking date. one_active_loan_per_key latest effective predicate from 0007:
-- status IN ('CHECKED_OUT','LATE','RETURN_REPORTED'). Room-holder enforcement in 0024
-- supplies the newer self-service room-level protection.

-- Cabinet/status APIs
-- public.get_admin_key_cabinet() latest definition: 0024 (replaces 0023).
-- Colors/status semantics derive from room active state and loans: unavailable rooms,
-- available key/no holder, or checked-out/late holder. RETURNED no longer counts held.
-- Views: key_current_status_v, active_key_loans_v (0007), key_loan_report_v latest
-- 0023, admin_key_activity_v (0021).

-- Superseded definitions: request_booking_key 0019/0023; report_key_status 0021;
-- get_admin_key_cabinet 0023; ensure_key_request_for_booking 0019 then 0025;
-- get_room_slot_permissions and request_class_key 0019/0022 then 0023.

-- UNVERIFIED: availability counts and the current holder are runtime-data dependent.

