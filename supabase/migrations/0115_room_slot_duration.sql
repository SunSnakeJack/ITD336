-- Existing reservations retain their times. Remove only the obsolete category settings.
update public.room_category_restrictions
set policy=policy - array['minMinutes','maxMinutes']
where policy ?| array['minMinutes','maxMinutes'];

create function public.room_category_slot_minutes(p_category text)
returns integer language sql stable set search_path='' as $$
 select coalesce((select (policy->>'slotMinutes')::integer
 from public.room_category_restrictions where category=p_category),30)
$$;

create or replace function public.meeting_room_operating_hours()
returns table(opens_at time, closes_at time)
language sql stable set search_path='' as $$
 select coalesce((p.policy->>'opensAt')::time,time '08:00'),
        coalesce((p.policy->>'closesAt')::time,time '18:00')
 from (values ('MEETING')) c(category)
 left join public.room_category_restrictions p using(category)
$$;

create function public.get_public_room_slot_policies()
returns table(room_id uuid, opens_at time, closes_at time, slot_minutes integer)
language sql stable security definer set search_path='' as $$
 select r.id,h.opens_at,h.closes_at,public.room_category_slot_minutes(public.room_policy_category(r.id))
 from public.get_public_room_catalog() r
 cross join lateral public.key_request_operating_hours(r.id) h
 where r.usage_scope='LABORATORY'
 union all
 select r.id,h.opens_at,h.closes_at,public.room_category_slot_minutes('MEETING')
 from public.get_public_room_catalog() r
 cross join public.meeting_room_operating_hours() h
 where r.usage_scope='MEETING'
$$;

create function public.is_room_slot_range(p_start time, p_end time, p_opens time, p_closes time, p_minutes integer)
returns boolean language sql immutable set search_path='' as $$
 select p_start >= p_opens and p_end > p_start and p_end <= p_closes
    and mod(extract(epoch from (p_start-p_opens)),p_minutes * 60)=0
    and mod(extract(epoch from (p_end-p_opens)),p_minutes * 60)=0
$$;

revoke all on function public.room_category_slot_minutes(text),
 public.is_room_slot_range(time,time,time,time,integer), public.get_public_room_slot_policies()
 from public,anon,authenticated;
grant execute on function public.get_public_room_slot_policies() to anon,authenticated;

create or replace function public.save_permission_settings_v2(p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_category text; v_policy jsonb; v_previous jsonb;
begin
 perform public.save_permission_settings(p_changes - 'roomPolicies');
 for v_category,v_policy in select key,value from jsonb_each(coalesce(p_changes->'roomPolicies','{}'::jsonb)) loop
  -- Ignore obsolete keys from older clients while they upgrade.
  v_policy := v_policy - array['minMinutes','maxMinutes'];
  if v_category not in ('LAB','SPECIAL','MEETING') or jsonb_typeof(v_policy) <> 'object'
     or (v_policy - array['loginForKey','days','opensAt','closesAt','slotMinutes','dailyLimit','advanceDays','approvalMode','approvalDeadline','requireRejectionReason']) <> '{}'::jsonb
     or (v_policy ? 'requireRejectionReason' and jsonb_typeof(v_policy->'requireRejectionReason') <> 'boolean')
     or (v_policy ? 'approvalMode' and coalesce(v_policy->>'approvalMode','') not in ('AUTO','MANUAL'))
     or (v_policy ? 'approvalDeadline' and coalesce(v_policy->>'approvalDeadline','') not in ('START','END'))
     or (v_policy ? 'loginForKey' and jsonb_typeof(v_policy->'loginForKey') <> 'boolean')
     or (v_policy ? 'days' and (jsonb_typeof(v_policy->'days') <> 'array' or exists(
         select 1 from jsonb_array_elements_text(v_policy->'days') as d(day) where day !~ '^[0-6]$')))
     or (v_policy ? 'opensAt' and coalesce(v_policy->>'opensAt','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     or (v_policy ? 'closesAt' and coalesce(v_policy->>'closesAt','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     or (v_policy->>'opensAt')::time >= (v_policy->>'closesAt')::time
     or (case when v_policy ? 'slotMinutes' and (jsonb_typeof(v_policy->'slotMinutes') <> 'number'
         or (v_policy->>'slotMinutes') !~ '^[1-9][0-9]{0,3}$') then true
       else coalesce((v_policy->>'slotMinutes')::integer,30) * 60 > extract(epoch from (
         coalesce((v_policy->>'closesAt')::time,time '18:00') - coalesce((v_policy->>'opensAt')::time,time '08:00'))) end)
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

create or replace function public.enforce_room_category_restrictions()
returns trigger language plpgsql security definer set search_path='' as $$
declare
 v_category text := public.room_policy_category(new.room_id);
 v_policy jsonb;
 v_start timestamp := new.starts_at at time zone 'Asia/Bangkok';
 v_end timestamp := new.ends_at at time zone 'Asia/Bangkok';
 v_day date := v_start::date;
 v_opens time;
 v_closes time;
 v_count integer;
 v_limit integer;
 v_identity text;
begin
 if tg_op='UPDATE' and (old.room_id,old.starts_at,old.ends_at) is not distinct from (new.room_id,new.starts_at,new.ends_at) then return new; end if;
 select policy into v_policy from public.room_category_restrictions where category=v_category;

 if tg_table_name='key_requests' and coalesce((v_policy->>'loginForKey')::boolean,false) and auth.uid() is null
 then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if (v_policy ? 'days' and not v_policy->'days' @> jsonb_build_array(extract(dow from v_day)::int)
     and (extract(dow from v_day) <> 6 or public.get_open_saturday()::date is distinct from v_day))
    or v_start::time < (v_policy->>'opensAt')::time or v_end::time > (v_policy->>'closesAt')::time
    or ((v_policy ? 'opensAt' or v_policy ? 'closesAt') and v_day <> v_end::date)
 then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
 if v_day > (now() at time zone 'Asia/Bangkok')::date + (v_policy->>'advanceDays')::int
 then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 if tg_table_name='key_requests' or v_category='MEETING' then
  if tg_table_name='key_requests' then
   select h.opens_at,h.closes_at into v_opens,v_closes from public.key_request_operating_hours(new.room_id) h;
  else
   select h.opens_at,h.closes_at into v_opens,v_closes from public.meeting_room_operating_hours() h;
  end if;
  if v_day<>v_end::date or not public.is_room_slot_range(
     v_start::time,v_end::time,v_opens,v_closes,public.room_category_slot_minutes(v_category)) then
   raise exception 'INVALID_ROOM_SLOT_RANGE' using errcode='22023';
  end if;
 end if;
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

create or replace function public.get_own_request_edit_context(p_id uuid, p_type text)
returns table(room_id uuid, service_date date, opens_at time, closes_at time)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.profiles where id = v_actor and account_status = 'ACTIVE'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_type = 'booking' then
    return query
    select b.room_id, (b.starts_at at time zone 'Asia/Bangkok')::date,
      case when rt.usage_scope = 'MEETING' then mh.opens_at else coalesce(
        (select (rule_value #>> '{}')::time from public.booking_rules where rule_key = 'GENERAL_OPEN_TIME' and active), time '08:30') end,
      case when rt.usage_scope = 'MEETING' then mh.closes_at else coalesce(
        (select (rule_value #>> '{}')::time from public.booking_rules where rule_key = 'GENERAL_CLOSE_TIME' and active), time '17:30') end
    from public.bookings b
    join public.rooms r on r.id = b.room_id and r.active and r.booking_enabled
    join public.room_types rt on rt.id = r.room_type_id
    cross join public.meeting_room_operating_hours() mh
    where b.id = p_id and b.requester_id = v_actor and b.starts_at > now()
      and b.status in ('PENDING', 'APPROVED');
  elsif p_type = 'key_request' then
    return query
    select k.room_id, (k.starts_at at time zone 'Asia/Bangkok')::date, h.opens_at, h.closes_at
    from public.key_requests k join public.rooms r on r.id = k.room_id and r.active
    cross join lateral public.key_request_operating_hours(k.room_id) h
    where k.id = p_id and k.starts_at > now() and k.status in ('PENDING_APPROVAL', 'APPROVED')
      and (k.authenticated_user_id = v_actor or (k.authenticated_user_id is null and exists (
        select 1 from auth.users u where u.id = v_actor and u.email_confirmed_at is not null
          and lower(u.email) = lower(k.requester_email)
      )));
  end if;
end;
$$;

create or replace function public.get_own_request_edit_times(p_id uuid, p_type text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_context record;
  v_intervals jsonb;
begin
  select * into v_context from public.get_own_request_edit_context(p_id, p_type);
  if not found then raise exception 'REQUEST_NOT_EDITABLE' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('startsAt', e.starts_at, 'endsAt', e.ends_at)), '[]'::jsonb)
    into v_intervals
  from (
    select s.starts_at, s.ends_at
    from public.get_public_room_schedule_events(v_context.room_id, v_context.service_date, v_context.service_date) s
    where s.id <> (replace(p_type, '_', '-') || ':' || md5(p_id::text))
    union all
    select coalesce(b.starts_at, l.checked_out_at, l.requested_at),
      coalesce(b.ends_at, l.expected_return_at, l.requested_at + interval '1 minute')
    from public.key_loans l left join public.bookings b on b.id = l.booking_id
    where p_type = 'key_request' and l.room_id = v_context.room_id
      and l.status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')
      and coalesce(b.starts_at, l.checked_out_at, l.requested_at)
        < ((v_context.service_date + 1)::timestamp at time zone 'Asia/Bangkok')
      and coalesce(b.ends_at, l.expected_return_at, l.requested_at + interval '1 minute')
        > (v_context.service_date::timestamp at time zone 'Asia/Bangkok')
  ) e;
  return jsonb_build_object('date', v_context.service_date, 'opensAt', v_context.opens_at,
    'closesAt', v_context.closes_at, 'slotMinutes',
    case when p_type='key_request' or public.room_policy_category(v_context.room_id)='MEETING'
      then public.room_category_slot_minutes(public.room_policy_category(v_context.room_id)) else 30 end, 'intervals', v_intervals);
end;
$$;

create or replace function public.reschedule_own_request(
  p_id uuid, p_type text, p_start timestamptz, p_end timestamptz, p_purpose text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_context record;
  v_start timestamp := p_start at time zone 'Asia/Bangkok';
  v_end timestamp := p_end at time zone 'Asia/Bangkok';
  v_purpose text := nullif(btrim(p_purpose), '');
  v_old_start timestamptz;
  v_old_end timestamptz;
begin
  select * into v_context from public.get_own_request_edit_context(p_id, p_type);
  if not found then raise exception 'REQUEST_NOT_EDITABLE' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_context.room_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_context.room_id::text, 336));
  if p_type = 'booking' then
    select starts_at, ends_at into v_old_start, v_old_end from public.bookings where id = p_id for update;
  else
    select starts_at, ends_at into v_old_start, v_old_end from public.key_requests where id = p_id for update;
  end if;
  select * into v_context from public.get_own_request_edit_context(p_id, p_type);
  if not found or v_old_start <= clock_timestamp() then
    raise exception 'REQUEST_NOT_EDITABLE' using errcode = '42501';
  end if;

  if p_start is null or p_end is null or p_start <= clock_timestamp() or p_end <= p_start
     or v_start::date <> v_context.service_date or v_end::date <> v_context.service_date
     or ((p_start,p_end) is distinct from (v_old_start,v_old_end) and not public.is_room_slot_range(
       v_start::time,v_end::time,v_context.opens_at,v_context.closes_at,
       case when p_type='key_request' or public.room_policy_category(v_context.room_id)='MEETING'
         then public.room_category_slot_minutes(public.room_policy_category(v_context.room_id)) else 30 end)) then
    raise exception 'INVALID_REQUEST_TIME' using errcode = '22023';
  end if;

  if (p_start, p_end) is distinct from (v_old_start, v_old_end) then
    if p_type = 'booking' and exists (
      select 1 from public.key_loans where booking_id = p_id
        and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')
    ) then raise exception 'BOOKING_HAS_KEY_LOAN' using errcode = '22023'; end if;
    if exists (
      select 1 from jsonb_to_recordset(public.get_own_request_edit_times(p_id, p_type) -> 'intervals')
        as e("startsAt" timestamptz, "endsAt" timestamptz)
      where e."startsAt" < p_end and e."endsAt" > p_start
    ) or (p_type = 'booking' and exists (
      select 1 from public.check_room_availability(v_context.room_id, p_start, p_end, p_id) where not available
    )) then raise exception 'ROOM_UNAVAILABLE' using errcode = '23P01'; end if;
  end if;

  if p_type = 'booking' then
    if v_purpose is null then raise exception 'PURPOSE_REQUIRED' using errcode = '22023'; end if;
    update public.bookings set starts_at = p_start, ends_at = p_end, purpose = v_purpose where id = p_id;
  else
    update public.key_requests
    set starts_at = p_start, ends_at = p_end,
      purpose = case when purpose_type = 'OTHER' then coalesce(v_purpose, purpose) else purpose end
    where id = p_id;
  end if;
  perform public.write_audit(v_actor, 'REQUEST_UPDATED', p_type, p_id,
    jsonb_build_object('previous_start', v_old_start, 'previous_end', v_old_end, 'start', p_start, 'end', p_end));
end;
$$;
