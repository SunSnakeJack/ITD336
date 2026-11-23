create function public.save_permission_settings(p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_change jsonb;
 v_role uuid;
 v_permission uuid;
 v_enabled boolean;
 v_previous boolean;
begin
 if v_actor is null or not public.has_role('ADMIN') or not public.has_permission('SETTINGS_MANAGE') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if jsonb_typeof(p_changes) is distinct from 'object' then raise exception 'INVALID_SETTINGS'; end if;

 for v_change in select value from jsonb_array_elements(coalesce(p_changes->'roleGrants','[]'::jsonb)) loop
  if coalesce(v_change->>'role','') not in ('STUDENT','TEACHER','DEAN','DEPARTMENT_HEAD','STAFF')
     or coalesce(v_change->>'permission','') not in ('ROOM_MANAGE','BOOKING_APPROVE','BOOKING_OVERRIDE','KEY_MANAGE',
       'USER_MANAGE','SETTINGS_MANAGE','REPORT_READ','AUDIT_READ')
     or jsonb_typeof(v_change->'enabled') is distinct from 'boolean' then
   raise exception 'INVALID_ROLE_GRANT';
  end if;
  select id into strict v_role from public.roles where code=v_change->>'role' for update;
  select id into strict v_permission from public.permissions where code=v_change->>'permission';
  v_enabled := (v_change->>'enabled')::boolean;
  select exists(select 1 from public.role_permissions where role_id=v_role and permission_id=v_permission) into v_previous;
  if v_enabled = v_previous then continue; end if;
  if v_enabled then
   insert into public.role_permissions(role_id,permission_id) values(v_role,v_permission);
  else
   delete from public.role_permissions where role_id=v_role and permission_id=v_permission;
  end if;
  perform public.write_audit(v_actor,'ROLE_PERMISSION_UPDATED','role',v_role,
    jsonb_build_object('role_code',v_change->>'role','permission',v_change->>'permission','before',v_previous,'after',v_enabled));
 end loop;

 if p_changes ? 'meetingAdvanceDays' then
  perform public.set_meeting_advance_booking_days((p_changes->>'meetingAdvanceDays')::integer);
 end if;
 if p_changes ? 'allowElapsed' then
  perform public.set_admin_key_request_timing_setting((p_changes->>'allowElapsed')::boolean);
 end if;
 if p_changes ? 'openSaturday' then
  perform public.set_open_saturday((p_changes->>'openSaturday')::date);
 end if;
end $$;

revoke all on function public.save_permission_settings(jsonb) from public,anon,authenticated;
grant execute on function public.save_permission_settings(jsonb) to authenticated;
