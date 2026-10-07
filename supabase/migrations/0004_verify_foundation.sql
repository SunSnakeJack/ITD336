-- Non-destructive deployment assertions for the ITD336 database foundation.
-- A failed assertion rolls back this migration and identifies schema drift.
do $$
declare
  v_actual integer;
  v_missing text;
  v_expected_tables constant text[] := array[
    'organizations','roles','permissions','role_permissions','profiles','user_roles',
    'room_types','rooms','equipment','room_equipment','class_schedules','room_blocks',
    'room_operating_hours','bookings','booking_approvals','booking_status_history',
    'room_keys','key_loans','key_loan_history','key_incidents','key_compensations',
    'notifications','notification_deliveries','booking_rules','system_settings','holidays','audit_logs'
  ];
  v_expected_views constant text[] := array[
    'room_current_status_v','booking_details_v','key_current_status_v',
    'active_key_loans_v','user_booking_history_v','staff_pending_bookings_v'
  ];
  v_expected_functions constant text[] := array[
    'set_updated_at','handle_new_user','has_permission','check_room_availability',
    'list_available_rooms','write_audit','create_notification','create_booking',
    'approve_booking','reject_booking','cancel_booking','request_key',
    'approve_key_request','checkout_key','return_key','mark_notification_read'
  ];
begin
  select count(*) into v_actual from pg_catalog.pg_tables where schemaname = 'public';
  if v_actual <> 27 then raise exception 'Expected 27 public tables, found %', v_actual; end if;

  select string_agg(expected, ', ' order by expected) into v_missing
  from unnest(v_expected_tables) expected
  where not exists (
    select 1 from pg_catalog.pg_tables t where t.schemaname = 'public' and t.tablename = expected
  );
  if v_missing is not null then raise exception 'Missing tables: %', v_missing; end if;

  select count(*) into v_actual from pg_catalog.pg_views where schemaname = 'public';
  if v_actual <> 6 then raise exception 'Expected 6 public views, found %', v_actual; end if;

  select string_agg(expected, ', ' order by expected) into v_missing
  from unnest(v_expected_views) expected
  where not exists (
    select 1 from pg_catalog.pg_views v where v.schemaname = 'public' and v.viewname = expected
  );
  if v_missing is not null then raise exception 'Missing views: %', v_missing; end if;

  select string_agg(expected, ', ' order by expected) into v_missing
  from unnest(v_expected_functions) expected
  where not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = expected
  );
  if v_missing is not null then raise exception 'Missing functions: %', v_missing; end if;

  select count(*) into v_actual
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c where c like 'search_path=%');
  if v_actual <> 0 then raise exception '% SECURITY DEFINER functions lack a fixed search_path', v_actual; end if;

  select count(*) into v_actual
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity;
  if v_actual <> 27 then raise exception 'Expected RLS on 27 public tables, found %', v_actual; end if;

  select count(*) into v_actual from pg_catalog.pg_policies where schemaname = 'public';
  if v_actual <> 41 then raise exception 'Expected 41 public RLS policies, found %', v_actual; end if;

  if has_table_privilege('anon', 'public.bookings', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('anon', 'public.audit_logs', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'anon has unexpected privileges on sensitive tables';
  end if;
  if has_table_privilege('authenticated', 'public.bookings', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.booking_approvals', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.booking_status_history', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.key_loans', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.key_loan_history', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.audit_logs', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated has direct mutation privileges on RPC-controlled tables';
  end if;
  if has_table_privilege('authenticated', 'public.user_roles', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.role_permissions', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated can elevate roles or permissions directly';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint where conname = 'no_overlapping_active_bookings' and contype = 'x'
  ) then raise exception 'Booking overlap exclusion constraint is missing'; end if;
  if not exists (
    select 1 from pg_catalog.pg_indexes where schemaname = 'public' and indexname = 'one_active_key_request_per_booking'
  ) or not exists (
    select 1 from pg_catalog.pg_indexes where schemaname = 'public' and indexname = 'one_active_loan_per_key'
  ) then raise exception 'Active key-loan uniqueness indexes are missing'; end if;

  if (select count(*) from public.roles) <> 3 then raise exception 'Expected 3 seeded roles'; end if;
  if (select count(*) from public.permissions) <> 10 then raise exception 'Expected 10 seeded permissions'; end if;
  if (select count(*) from public.room_types) <> 6 then raise exception 'Expected 6 seeded room types'; end if;
  if (select count(*) from public.rooms) <> 6 then raise exception 'Expected 6 seeded rooms'; end if;
  if (select count(*) from public.equipment) <> 6 then raise exception 'Expected 6 seeded equipment records'; end if;
  if (select count(*) from public.room_keys) <> 4 then raise exception 'Expected 4 seeded physical room keys'; end if;
  if (select count(*) from public.booking_rules) <> 9 then raise exception 'Expected 9 seeded booking rules'; end if;
  if (select count(*) from public.system_settings) <> 1 then raise exception 'Expected 1 seeded system setting'; end if;
end
$$;
