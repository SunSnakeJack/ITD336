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

-- Sources: 0001_schema.sql, 0002_functions.sql, 0003_rls_views_indexes.sql,
-- 0005_v2_schema_rbac.sql, 0006_v2_workflow_functions.sql,
-- 0007_v2_rls_views_indexes.sql, 0014_academic_term_settings.sql,
-- 0023_room_permission_matrix_and_key_availability.sql.

-- Authentication integration
-- public.handle_new_user() is SECURITY DEFINER with search_path=''. The
-- on_auth_user_created trigger inserts a public.profiles row after auth.users insert.

-- Authorization helpers (latest effective signatures):
-- public.has_permission(p_permission text) RETURNS boolean
--   Source: 0002_functions.sql
-- public.has_role(p_role text) RETURNS boolean
--   Source: 0006_v2_workflow_functions.sql
-- Both require auth.uid(), an ACTIVE profile, and matching RBAC data.

-- Seeded/system roles evolved from STUDENT/TEACHER/STAFF to also include ADMIN and
-- PRIORITY_USER (0005). ADMIN receives all permissions existing at that migration.
-- Permission checks remain the canonical authorization mechanism for management RPCs.

-- RLS is enabled for the 27 foundation tables in 0003 and additionally for
-- external_parties (0007), academic_terms (0014), and room_usage_policies (0023).

-- Current policy inventory reconstructed by applying CREATE/DROP in order (46):
-- Identity: authenticated read organizations; authenticated read role catalog;
-- authenticated read permission catalog; read role permissions;
-- read own roles or user managers; read own profile or user managers;
-- update safe own profile fields.
-- Rooms/schedules: authenticated read room types; authenticated read active rooms;
-- room managers insert/update rooms; authenticated read equipment/room equipment;
-- room managers maintain room equipment; authenticated read schedules/room blocks/
-- operating hours; schedule managers maintain schedules/blocks/hours;
-- authenticated read academic terms.
-- Booking: read own bookings or booking managers; read related approval history or
-- booking managers; read related booking history or booking managers.
-- Keys: authenticated read tracked key inventory; key managers maintain inventory;
-- read own loans or key managers; read related loan history or key managers;
-- key managers read/maintain incidents and compensation.
-- Notifications/config/audit: users read own notifications/deliveries and mark own
-- notifications; authenticated read booking rules/holidays; settings managers maintain
-- rules/settings/holidays; settings managers read room policies; audit readers only.
-- External parties: admins read/create/update external parties.

-- Grants and restrictions
-- 0003 revokes anonymous table access and direct client mutation of RPC-controlled
-- booking, key-loan, notification and audit tables. Later migrations grant narrowly
-- scoped EXECUTE permissions on individual RPC signatures. SECURITY DEFINER functions
-- consistently declare a fixed empty search_path and qualify public objects.

-- Superseded policies (do not treat as current): policies named "...booking staff",
-- "...key staff" and "authenticated read key inventory" were dropped/replaced in 0007.

-- UNVERIFIED: static migration review cannot prove remote role membership, grants
-- introduced manually, or the remote pg_policies catalog. Compare the linked project
-- catalog separately if operational verification is required.

