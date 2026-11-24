-- Service access is independent of management permissions.
insert into public.permissions(code,description) values
 ('KEY_REQUEST_GENERAL','Request a key for a general laboratory'),
 ('KEY_REQUEST_SPECIAL','Request a key for a special laboratory'),
 ('MEETING_BOOK','Book a meeting room'),
 ('STAFF_ACCESS','Enter the staff workspace')
on conflict(code) do nothing;

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where (r.code in ('STUDENT','TEACHER','DEAN','DEPARTMENT_HEAD','STAFF','ADMIN','PRIORITY_USER')
       and p.code in ('KEY_REQUEST_GENERAL','KEY_REQUEST_SPECIAL'))
   or (r.code in ('TEACHER','DEAN','DEPARTMENT_HEAD','ADMIN','PRIORITY_USER') and p.code='MEETING_BOOK')
   or (r.code in ('DEAN','DEPARTMENT_HEAD','ADMIN','PRIORITY_USER') and p.code='BOOKING_OVERRIDE')
   or (r.code in ('STAFF','ADMIN') and p.code='STAFF_ACCESS')
on conflict do nothing;

delete from public.role_permissions rp using public.roles r, public.permissions p
where rp.role_id=r.id and rp.permission_id=p.id
 and r.code in ('STUDENT','TEACHER','STAFF') and p.code='BOOKING_OVERRIDE';

insert into public.system_settings(setting_key,setting_value,description)
values ('GUEST_GENERAL_KEY_ENABLED','true','Guests may request general laboratory keys when sign-in is optional')
on conflict(setting_key) do nothing;

create function public.get_guest_general_key_enabled()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select setting_value='true'::jsonb from public.system_settings
 where setting_key='GUEST_GENERAL_KEY_ENABLED'),true)
$$;

create function public.get_viewer_permissions()
returns text[] language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then
   case when public.get_guest_general_key_enabled() then array['KEY_REQUEST_GENERAL'] else array[]::text[] end
 else coalesce(array(
   select distinct p.code from public.user_roles ur
   join public.profiles pr on pr.id=ur.user_id and pr.account_status='ACTIVE'
   join public.role_permissions rp on rp.role_id=ur.role_id
   join public.permissions p on p.id=rp.permission_id where ur.user_id=auth.uid()
 ),array[]::text[]) end
$$;

create function public.enforce_key_request_service_permission()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_special boolean;
begin
 if tg_op='UPDATE' and (old.room_id,old.starts_at,old.ends_at) is not distinct from (new.room_id,new.starts_at,new.ends_at) then
  return new;
 end if;
 select rt.requires_sso_for_key_request into v_special
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id where r.id=new.room_id;
 if auth.uid() is null then
  if v_special then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
  if not public.get_guest_general_key_enabled() then
   raise exception 'KEY_REQUEST_PERMISSION_REQUIRED' using errcode='42501';
  end if;
 elsif not public.has_permission(case when v_special then 'KEY_REQUEST_SPECIAL' else 'KEY_REQUEST_GENERAL' end) then
  raise exception 'KEY_REQUEST_PERMISSION_REQUIRED' using errcode='42501';
 end if;
 return new;
end $$;

create trigger enforce_key_request_service_permission before insert or update of room_id,starts_at,ends_at on public.key_requests
for each row execute function public.enforce_key_request_service_permission();

create or replace function public.enforce_meeting_booking_role()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.room_id,old.starts_at,old.ends_at) is not distinct from (new.room_id,new.starts_at,new.ends_at) then
  return new;
 end if;
 if exists (select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
    where r.id=new.room_id and rt.usage_scope='MEETING')
    and not public.has_permission('MEETING_BOOK') then
  raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 return new;
end $$;

drop trigger enforce_meeting_booking_role on public.bookings;
create trigger enforce_meeting_booking_role before insert or update of room_id,starts_at,ends_at on public.bookings
for each row execute function public.enforce_meeting_booking_role();

revoke all on function public.get_guest_general_key_enabled(),public.get_viewer_permissions(),
 public.enforce_key_request_service_permission(),public.enforce_meeting_booking_role() from public,anon,authenticated;
grant execute on function public.get_guest_general_key_enabled(),public.get_viewer_permissions() to anon,authenticated;

create or replace function public.save_permission_settings(p_changes jsonb)
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
       'USER_MANAGE','SETTINGS_MANAGE','REPORT_READ','AUDIT_READ','KEY_REQUEST_GENERAL','KEY_REQUEST_SPECIAL','MEETING_BOOK','STAFF_ACCESS')
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

 if p_changes ? 'guestGeneralKey' then
  if jsonb_typeof(p_changes->'guestGeneralKey') is distinct from 'boolean' then
   raise exception 'INVALID_GUEST_PERMISSION' using errcode='22023';
  end if;
  select setting_value='true'::jsonb into v_previous from public.system_settings
   where setting_key='GUEST_GENERAL_KEY_ENABLED' for update;
  v_enabled := (p_changes->>'guestGeneralKey')::boolean;
  if v_enabled is distinct from v_previous then
   insert into public.system_settings(setting_key,setting_value,description,updated_by)
   values('GUEST_GENERAL_KEY_ENABLED',to_jsonb(v_enabled),'Guests may request general laboratory keys when sign-in is optional',v_actor)
   on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_by=v_actor,updated_at=now();
   perform public.write_audit(v_actor,'GUEST_KEY_PERMISSION_UPDATED','system_setting',null,
    jsonb_build_object('before',v_previous,'after',v_enabled));
  end if;
 end if;

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
