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

-- Sources: 0001–003, 0006–007, 0020–0021, 0023–0027.

-- Tables
-- notifications: per-user in-app notification, optional related entity, read_at.
-- notification_deliveries: IN_APP/EMAIL channel delivery state.
-- audit_logs: append-only actor/action/entity/metadata event record.

-- Internal helpers
-- public.create_notification(uuid,text,text,text,text,uuid) -- 0002
-- public.write_audit(uuid,text,text,uuid,jsonb)             -- 0002
-- Both are SECURITY DEFINER and revoked from normal direct client execution.

-- Notification read APIs
-- public.mark_notification_read(uuid) -- latest 0021; returns boolean and owns user filter.
-- public.mark_all_notifications_read() -- 0021; returns integer affected count.

-- Reporting/status views
-- operational_room_summary_v, booking_report_v             -- 0007
-- key_loan_report_v                                        -- latest 0023
-- admin_key_activity_v                                     -- 0021
-- booking_details_v, user_booking_history_v,
-- staff_pending_bookings_v, key_current_status_v,
-- active_key_loans_v, room_current_status_v                 -- latest 0007

-- Report visibility remains constrained by grants, RLS on base tables, and
-- security_invoker=true except operational_room_summary_v, which is explicitly
-- security_invoker=false and security_barrier=true in 0007. Treat that view as a
-- deliberately sanitized summary and review changes carefully.

-- Audit producers include booking create/approval/cancel/expiry, schedule changes,
-- room changes, key checkout/return/status reports and permission configuration.

-- UNVERIFIED: queued EMAIL rows do not prove external delivery; no mail worker or
-- provider state is represented by static migrations.

