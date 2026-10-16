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

-- Canonical foundation: 0001_schema.sql
-- Additive structural changes: 0005_v2_schema_rbac.sql,
-- 0008_academic_schedule_management.sql, 0014_academic_term_settings.sql,
-- 0018_room_layout_key_and_code_edit.sql, 0021_user_reported_key_status_and_notification_reads.sql,
-- 0023_room_permission_matrix_and_key_availability.sql.

-- Extensions: extensions.pgcrypto, extensions.btree_gist.
-- Public enum types (latest values reconstructed from migrations):
-- account_status: ACTIVE, SUSPENDED, INACTIVE
-- booking_status: PENDING, APPROVED, REJECTED, CANCELLED, IN_USE, COMPLETED,
--                 NO_SHOW, SUPERSEDED
-- key_loan_status: REQUESTED, APPROVED, REJECTED, CHECKED_OUT, RETURNED, LATE,
--                  LOST, DAMAGED, CANCELLED, RETURN_REPORTED
-- approval_action, key_status, incident_type, incident_status,
-- compensation_status, delivery_channel, delivery_status, booking_policy,
-- key_usage_source, key_tracking_mode, schedule_type, schedule_status.

-- Current public tables (30; statically verified from 0001–0023):
-- Identity/RBAC: organizations, roles, permissions, role_permissions, profiles,
--                user_roles, external_parties
-- Rooms: room_types, rooms, equipment, room_equipment, room_blocks,
--        room_operating_hours, class_schedules, academic_terms
-- Booking: bookings, booking_approvals, booking_status_history
-- Keys: room_keys, key_loans, key_loan_history, key_incidents, key_compensations
-- Messaging/config: notifications, notification_deliveries, booking_rules,
--                   system_settings, holidays, audit_logs, room_usage_policies

-- Important relationship reference (not executable):
-- profiles.id -> auth.users.id (ON DELETE CASCADE)
-- bookings.requester_id/created_by/beneficiary_user_id -> profiles.id
-- bookings.room_id -> rooms.id
-- bookings.external_party_id -> external_parties.id
-- bookings.superseded_by_booking_id -> bookings.id
-- class_schedules.room_id -> rooms.id
-- room_keys.room_id -> rooms.id
-- key_loans.booking_id -> bookings.id (nullable after 0005)
-- key_loans.room_id -> rooms.id (required after 0005)
-- key_loans.class_schedule_id -> class_schedules.id
-- key_loans.key_id -> room_keys.id
-- notifications.user_id -> profiles.id

-- Shared trigger function (0001_schema.sql; still effective):
-- CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
-- LANGUAGE plpgsql SET search_path = '' AS $$
-- BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Updated-at triggers exist for organizations, profiles, rooms, room_keys,
-- key_loans, key_compensations, external_parties, class_schedules and academic_terms.
-- The first six are created by dynamic SQL in 0001, so they are not all visible as
-- literal CREATE TRIGGER statements in static text searches.

-- Core invariants:
-- * bookings.ends_at > bookings.starts_at
-- * exclusion constraint no_overlapping_active_bookings protects APPROVED/IN_USE
-- * one_active_key_request_per_booking and one_active_loan_per_key are partial
--   unique indexes; their latest predicates are documented in 05_key_management.sql
-- * key_loans usage source and return evidence are constrained by 0005.
