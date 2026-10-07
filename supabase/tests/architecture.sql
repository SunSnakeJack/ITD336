-- Run after `supabase db reset` in a disposable local database.
-- This file is intentionally rollback-only and does not create auth identities.
begin;

do $$
begin
 assert (select count(*)=27 from pg_tables where schemaname='public'), 'unexpected application table count';
 assert (select count(*)=27 from pg_tables t where schemaname='public' and rowsecurity), 'RLS is not enabled on every application table';
 assert exists(select 1 from pg_constraint where conname='no_overlapping_active_bookings' and contype='x'), 'booking exclusion constraint missing';
 assert exists(select 1 from pg_indexes where indexname='one_active_loan_per_key'), 'active key loan unique index missing';
 assert not has_table_privilege('authenticated','public.audit_logs','INSERT'), 'authenticated can insert audit logs';
 assert not has_table_privilege('authenticated','public.bookings','UPDATE'), 'authenticated can directly update bookings';
end $$;

-- Workflow test matrix (requires Auth JWT sessions/fixtures):
-- A create_booking succeeds for an authenticated profile.
-- B overlapping APPROVED booking is rejected.
-- C/D staff permission allows approval/rejection; rejection without reason fails.
-- E owner cancellation succeeds and non-owner cancellation fails.
-- F request_key requires owned/authorized approved booking with requires_key.
-- G/H checkout locks one AVAILABLE key; concurrent second checkout fails.
-- I/J return sets RETURNED or LATE and releases the key.
-- K/L lost return creates incident; staff records compensation and paid timestamp.
-- M non-staff approve/checkout RPC calls fail with 42501.
-- N RLS hides another user's booking.

rollback;
