-- Optional per-category restrictions. Missing policy values preserve the existing workflow.
create table public.room_category_restrictions (
 category text primary key check (category in ('LAB','SPECIAL','MEETING')),
 policy jsonb not null
);
alter table public.room_category_restrictions enable row level security;
revoke all on public.room_category_restrictions from public,anon,authenticated;

create function public.get_room_category_restrictions()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_role('ADMIN') or not public.has_permission('SETTINGS_MANAGE') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 return coalesce((select jsonb_object_agg(category,policy) from public.room_category_restrictions),'{}'::jsonb);
end $$;

create function public.save_permission_settings_v2(p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_category text; v_policy jsonb; v_previous jsonb;
begin
 perform public.save_permission_settings(p_changes - 'roomPolicies');
 for v_category,v_policy in select key,value from jsonb_each(coalesce(p_changes->'roomPolicies','{}'::jsonb)) loop
  if v_category not in ('LAB','SPECIAL','MEETING') or jsonb_typeof(v_policy) <> 'object'
     or (v_policy - array['loginForKey','days','opensAt','closesAt','minMinutes','maxMinutes','dailyLimit','advanceDays']) <> '{}'::jsonb
     or (v_policy ? 'loginForKey' and jsonb_typeof(v_policy->'loginForKey') <> 'boolean')
     or (v_policy ? 'days' and (jsonb_typeof(v_policy->'days') <> 'array' or exists(
         select 1 from jsonb_array_elements_text(v_policy->'days') as d(day) where day !~ '^[0-6]$')))
     or (v_policy ? 'opensAt' and coalesce(v_policy->>'opensAt','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     or (v_policy ? 'closesAt' and coalesce(v_policy->>'closesAt','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     or (v_policy->>'opensAt')::time >= (v_policy->>'closesAt')::time
     or (v_policy ? 'minMinutes' and coalesce((v_policy->>'minMinutes')::int,0) not between 1 and 1440)
     or (v_policy ? 'maxMinutes' and coalesce((v_policy->>'maxMinutes')::int,0) not between 1 and 1440)
     or (v_policy->>'minMinutes')::int > (v_policy->>'maxMinutes')::int
     or (v_policy ? 'dailyLimit' and coalesce((v_policy->>'dailyLimit')::int,0) not between 1 and 100)
     or (v_policy ? 'advanceDays' and coalesce((v_policy->>'advanceDays')::int,-1) not between 0 and 30)
  then raise exception 'INVALID_ROOM_POLICY: %',v_category using errcode='22023'; end if;
  select policy into v_previous from public.room_category_restrictions where category=v_category for update;
  if v_previous is not distinct from v_policy then continue; end if;
  insert into public.room_category_restrictions(category,policy) values(v_category,v_policy)
  on conflict(category) do update set policy=excluded.policy;
  perform public.write_audit(auth.uid(),'ROOM_CATEGORY_POLICY_UPDATED','room_category',null,
    jsonb_build_object('name',v_category,'before',v_previous,'after',v_policy));
 end loop;
end $$;

create function public.room_policy_category(p_room_id uuid)
returns text language sql stable set search_path='' as $$
 select case when rt.usage_scope='MEETING' then 'MEETING'
             when rt.report_category::text='SPECIAL_LAB' then 'SPECIAL'
             else 'LAB' end
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id where r.id=p_room_id
$$;

create function public.enforce_room_category_restrictions()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_category text := public.room_policy_category(new.room_id);
 v_policy jsonb;
 v_start timestamp := new.starts_at at time zone 'Asia/Bangkok';
 v_end timestamp := new.ends_at at time zone 'Asia/Bangkok';
 v_day date := v_start::date;
 v_minutes numeric := extract(epoch from new.ends_at-new.starts_at)/60;
 v_count integer;
 v_limit integer;
 v_identity text;
begin
 if tg_op='UPDATE' and (old.room_id,old.starts_at,old.ends_at) is not distinct from (new.room_id,new.starts_at,new.ends_at) then return new; end if;
 select policy into v_policy from public.room_category_restrictions where category=v_category;
 if v_policy is null then return new; end if;
 if tg_table_name='key_requests' and coalesce((v_policy->>'loginForKey')::boolean,false) and auth.uid() is null
 then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if (v_policy ? 'days' and not v_policy->'days' @> jsonb_build_array(extract(dow from v_day)::int)
     and (extract(dow from v_day) <> 6 or public.get_open_saturday()::date is distinct from v_day))
    or v_start::time < (v_policy->>'opensAt')::time or v_end::time > (v_policy->>'closesAt')::time
    or ((v_policy ? 'opensAt' or v_policy ? 'closesAt') and v_day <> v_end::date)
 then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
 if v_day > (now() at time zone 'Asia/Bangkok')::date + (v_policy->>'advanceDays')::int
 then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 if v_minutes < (v_policy->>'minMinutes')::int or v_minutes > (v_policy->>'maxMinutes')::int
 then raise exception 'ROOM_REQUEST_DURATION_OUT_OF_RANGE'; end if;
 v_limit := (v_policy->>'dailyLimit')::int;
 if v_limit is not null then
  if tg_table_name='bookings' then
   v_identity := new.requester_id::text;
  else
   v_identity := lower(new.requester_email);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(concat_ws(':',tg_table_name,v_category,v_day,v_identity),1));
  if tg_table_name='bookings' then
   select count(*) into v_count from public.bookings b
   where b.requester_id=new.requester_id and b.id is distinct from new.id
     and b.starts_at >= (v_day::timestamp at time zone 'Asia/Bangkok')
     and b.starts_at < ((v_day+1)::timestamp at time zone 'Asia/Bangkok')
     and b.status in ('PENDING','APPROVED','IN_USE','COMPLETED') and public.room_policy_category(b.room_id)=v_category;
  else
   select count(*) into v_count from public.key_requests k
   where lower(k.requester_email)=v_identity and k.id is distinct from new.id
     and k.starts_at >= (v_day::timestamp at time zone 'Asia/Bangkok')
     and k.starts_at < ((v_day+1)::timestamp at time zone 'Asia/Bangkok')
     and k.status in ('PENDING_APPROVAL','APPROVED','IN_USE','RETURNED') and public.room_policy_category(k.room_id)=v_category;
  end if;
  if v_count >= v_limit then raise exception 'ROOM_REQUEST_DAILY_LIMIT'; end if;
 end if;
 return new;
end $$;

create trigger enforce_category_booking_restrictions before insert or update of room_id,starts_at,ends_at on public.bookings
for each row execute function public.enforce_room_category_restrictions();
create trigger enforce_category_key_restrictions before insert or update of room_id,starts_at,ends_at on public.key_requests
for each row execute function public.enforce_room_category_restrictions();

revoke all on function public.get_room_category_restrictions(), public.save_permission_settings_v2(jsonb),
 public.room_policy_category(uuid), public.enforce_room_category_restrictions() from public,anon,authenticated;
grant execute on function public.get_room_category_restrictions(), public.save_permission_settings_v2(jsonb) to authenticated;
