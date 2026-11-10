-- Read-only validation for the ITD336 staging baseline.
do $$
declare v_missing text;
begin
  select string_agg(code,', ' order by code) into v_missing
  from unnest(array['STUDENT','TEACHER','STAFF','ADMIN','PRIORITY_USER']) as required(code)
  where not exists(select 1 from public.roles r where r.code=required.code);
  if v_missing is not null then raise exception 'Missing roles: %',v_missing;end if;

  select string_agg(code,', ' order by code) into v_missing
  from unnest(array['ROOM_MANAGE','SCHEDULE_MANAGE','BOOKING_READ_ALL','BOOKING_APPROVE','BOOKING_MANAGE','KEY_MANAGE','USER_MANAGE','SETTINGS_MANAGE','AUDIT_READ','REPORT_READ','ROOM_READ_ALL','SCHEDULE_READ_ALL','OCCUPANCY_READ','BOOKING_OVERRIDE','KEY_DIRECT_USE','BOOKING_CREATE_FOR_OTHERS']) as required(code)
  where not exists(select 1 from public.permissions p where p.code=required.code);
  if v_missing is not null then raise exception 'Missing permissions: %',v_missing;end if;

  if exists(select code from public.roles group by code having count(*)>1) or exists(select code from public.permissions group by code having count(*)>1) then raise exception 'Duplicate RBAC codes';end if;

  if exists(select 1 from public.permissions p where not exists(select 1 from public.roles r join public.role_permissions rp on rp.role_id=r.id where r.code='ADMIN' and rp.permission_id=p.id)) then raise exception 'ADMIN is missing permissions';end if;
  if exists(select 1 from unnest(array['ROOM_READ_ALL','SCHEDULE_READ_ALL','OCCUPANCY_READ','REPORT_READ']) as required(code) where not exists(select 1 from public.roles r join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id where r.code='STAFF' and p.code=required.code)) then raise exception 'STAFF is missing read permissions';end if;
  if exists(select 1 from public.roles r join public.role_permissions rp on rp.role_id=r.id join public.permissions p on p.id=rp.permission_id where r.code='STAFF' and p.code not in('ROOM_READ_ALL','SCHEDULE_READ_ALL','OCCUPANCY_READ','REPORT_READ')) then raise exception 'STAFF has unexpected permissions';end if;

  select string_agg(code,', ' order by code) into v_missing
  from unnest(array['S2407','S2408','S2409','S2410','S2411','S2412','STUDIO','ESPORT','ELEARNING','MEET-FACULTY']) as required(code)
  where not exists(select 1 from public.rooms r where r.code=required.code);
  if v_missing is not null then raise exception 'Missing rooms: %',v_missing;end if;

  if exists(select 1 from public.rooms where layout_key is null) then raise exception 'Rooms missing layout_key';end if;
  if exists(select 1 from public.rooms where code in('S2407','S2408','S2409','S2410','S2411','S2412') and key_approval_mode<>'AUTO') then raise exception 'General labs have invalid approval mode';end if;
  if exists(select 1 from public.rooms where code in('STUDIO','ESPORT','ELEARNING') and key_approval_mode<>'ADMIN') then raise exception 'Special labs have invalid approval mode';end if;

  if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) then raise exception 'Public table without RLS';end if;
  if not (select relrowsecurity from pg_catalog.pg_class where oid='public.gmail_key_action_tokens'::regclass) then raise exception 'Gmail action tokens RLS disabled';end if;
  if exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and not exists(select 1 from unnest(coalesce(p.proconfig,array[]::text[])) c where c like 'search_path=%')) then raise exception 'SECURITY DEFINER function without fixed search_path';end if;

  if not pg_catalog.has_function_privilege('service_role','public.issue_gmail_key_action_token(uuid,uuid,text,text,timestamptz,text)','EXECUTE') then raise exception 'Service role cannot issue Gmail tokens';end if;
  if not pg_catalog.has_function_privilege('service_role','public.consume_gmail_key_action(text,text,uuid,uuid,text)','EXECUTE') then raise exception 'Service role cannot consume Gmail tokens';end if;
  if pg_catalog.has_function_privilege('anon','public.consume_gmail_key_action(text,text,uuid,uuid,text)','EXECUTE') or pg_catalog.has_function_privilege('authenticated','public.consume_gmail_key_action(text,text,uuid,uuid,text)','EXECUTE') then raise exception 'Gmail action RPC exposed to clients';end if;

  if exists(select 1 from information_schema.role_table_grants where table_schema='public' and table_name in('roles','permissions','role_permissions','secure_action_tokens','gmail_key_action_tokens','notification_outbox') and grantee in('anon','authenticated') and privilege_type in('INSERT','UPDATE','DELETE','TRUNCATE')) then raise exception 'Sensitive table mutation grant exposed';end if;

  if not exists(select 1 from public.booking_rules where rule_key='MAX_ADVANCE_BOOKING_DAYS' and rule_value='3'::jsonb and active) then raise exception 'Invalid MAX_ADVANCE_BOOKING_DAYS';end if;
  if not exists(select 1 from public.booking_rules where rule_key='CLOSED_WEEKDAYS' and rule_value='[6]'::jsonb and active) then raise exception 'Invalid CLOSED_WEEKDAYS';end if;
  if not exists(select 1 from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and rule_value='"08:30"'::jsonb and active) then raise exception 'Invalid GENERAL_OPEN_TIME';end if;
  if not exists(select 1 from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and rule_value='"18:30"'::jsonb and active) then raise exception 'Invalid GENERAL_CLOSE_TIME';end if;
  if not exists(select 1 from public.booking_rules where rule_key='LAB_USAGE_PERMISSION_POLICY' and active) then raise exception 'Missing LAB_USAGE_PERMISSION_POLICY';end if;
  if not exists(select 1 from public.system_settings where setting_key='DISPLAY_TIMEZONE' and setting_value='"Asia/Bangkok"'::jsonb) then raise exception 'Invalid DISPLAY_TIMEZONE';end if;
end
$$;

select 'roles' as check_name,count(*) as actual from public.roles
union all select 'permissions',count(*) from public.permissions
union all select 'rooms',count(*) from public.rooms
union all select 'room_types',count(*) from public.room_types
union all select 'gmail_key_action_tokens',count(*) from public.gmail_key_action_tokens;
