-- Share the configurable meeting booking horizon across both booking RPCs.
create function public.get_meeting_advance_booking_days()
returns integer
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null then coalesce((
    select case when (rule_value #>> '{}') ~ '^([1-9]|[12][0-9]|30)$'
      then (rule_value #>> '{}')::integer end
    from public.booking_rules
    where rule_key = 'MEETING_ADVANCE_BOOKING_DAYS' and active
  ), 3) end
$$;

create function public.set_meeting_advance_booking_days(p_days integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_rule_id uuid;
begin
  if v_actor is null or not public.has_permission('SETTINGS_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 30 then
    raise exception 'INVALID_MEETING_ADVANCE_BOOKING_DAYS' using errcode = '22023';
  end if;

  insert into public.booking_rules(rule_key, rule_value, description, active, updated_by)
  values ('MEETING_ADVANCE_BOOKING_DAYS', to_jsonb(p_days),
    'Meeting booking days from tomorrow, excluding closed Saturdays', true, v_actor)
  on conflict (rule_key) do update set
    rule_value = excluded.rule_value,
    description = excluded.description,
    active = true,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning id into v_rule_id;

  perform public.write_audit(v_actor, 'MEETING_ADVANCE_BOOKING_DAYS_UPDATED',
    'booking_rule', v_rule_id, jsonb_build_object('days', p_days));
  return p_days;
end
$$;

revoke all on function public.get_meeting_advance_booking_days(),
  public.set_meeting_advance_booking_days(integer) from public, anon;
grant execute on function public.get_meeting_advance_booking_days(),
  public.set_meeting_advance_booking_days(integer) to authenticated;

create or replace function public.get_meeting_booking_policy()
returns table(allowed_dates date[], opens_at time, closes_at time)
language sql stable security definer set search_path = '' as $$
  with settings as (
    select (now() at time zone 'Asia/Bangkok')::date as today,
      public.get_meeting_advance_booking_days() as day_limit,
      public.get_open_saturday() as open_saturday,
      coalesce((select (rule_value #>> '{}')::time from public.booking_rules
        where rule_key = 'GENERAL_OPEN_TIME' and active), time '08:30') as opening,
      coalesce((select (rule_value #>> '{}')::time from public.booking_rules
        where rule_key = 'GENERAL_CLOSE_TIME' and active), time '17:30') as closing
  )
  select array(
    select today + d
    from pg_catalog.generate_series(1, day_limit + (day_limit + 5) / 6) d
    where extract(dow from today + d) <> 6 or open_saturday = (today + d)::text
    order by d limit day_limit
  ), opening, closing
  from settings
  where auth.uid() is not null
$$;

-- Keep the dedicated RPC's existing approval and operating-hours behavior.
create or replace function public.create_meeting_booking(
 p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_booking public.bookings;
 v_allowed_dates date[];v_start_local timestamp;v_end_local timestamp;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
 if nullif(btrim(p_purpose),'') is null or p_ends_at<=p_starts_at then raise exception 'INVALID_BOOKING_INPUT';end if;
 if not exists(select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=p_room_id and r.active and r.booking_enabled and rt.usage_scope='MEETING') then raise exception 'MEETING_ROOM_NOT_AVAILABLE';end if;
 select allowed_dates into v_allowed_dates from public.get_meeting_booking_policy();
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok';v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 if not coalesce(v_start_local::date = any(v_allowed_dates), false) then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED';end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<time '08:00' or v_end_local::time>time '18:00' then raise exception 'OUTSIDE_SERVICE_HOURS';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text||':'||v_start_local::date::text,338));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then
  raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';
 end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,notes,status,requires_key,is_priority)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),p_notes,'APPROVED',false,public.has_permission('BOOKING_OVERRIDE'))
 returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason)
 values(v_booking.id,'APPROVED',v_actor,'Meeting booking automatically confirmed by approved baseline');
 perform public.write_audit(v_actor,'MEETING_BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id));
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

