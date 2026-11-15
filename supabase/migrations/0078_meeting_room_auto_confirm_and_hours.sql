-- Set a meeting-only operating window and keep the booking and calendar RPCs aligned.
create function public.meeting_room_operating_hours()
returns table(opens_at time, closes_at time)
language sql immutable set search_path = '' as $$
  select time '08:00', time '18:00'
$$;
revoke all on function public.meeting_room_operating_hours() from public;

-- Existing pending meeting requests retain their slot until staff review them.
create function public.meeting_room_has_pending_overlap(
  p_room_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
)
returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.bookings b
    where b.room_id = p_room_id and b.status = 'PENDING'
      and b.starts_at < p_ends_at and b.ends_at > p_starts_at
  )
$$;
revoke all on function public.meeting_room_has_pending_overlap(uuid, timestamptz, timestamptz) from public;

-- Student-role members can also hold a meeting-eligible role. Keep the
-- permission check, but leave meeting status to the meeting booking workflow.
create or replace function public.enforce_managed_lab_booking_policy()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_policy public.room_usage_policies;
begin
  if not public.has_role('STUDENT') then
    return new;
  end if;
  select * into v_policy from public.room_usage_policies where room_id = new.room_id;
  if not coalesce(v_policy.student_book_empty, true) then
    raise exception 'BOOKING_POLICY_DENIED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.rooms r join public.room_types rt on rt.id = r.room_type_id
    where r.id = new.room_id and rt.usage_scope = 'MEETING'
  ) then
    new.status := case when coalesce(v_policy.manual_approval, true)
      then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;
  end if;
  return new;
end;
$$;


create or replace function public.get_meeting_booking_policy()
returns table(allowed_dates date[], opens_at time, closes_at time)
language sql stable security definer set search_path = '' as $$
  with settings as (
    select (now() at time zone 'Asia/Bangkok')::date as today,
      public.get_meeting_advance_booking_days() as day_limit,
      public.get_open_saturday() as open_saturday
  )
  select array(
    select today + d
    from pg_catalog.generate_series(1, day_limit + (day_limit + 5) / 6) d
    where extract(dow from today + d) <> 6 or open_saturday = (today + d)::text
    order by d limit day_limit
  ), hours.opens_at, hours.closes_at
  from settings cross join public.meeting_room_operating_hours() hours
  where auth.uid() is not null
$$;

create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
 v_policy public.booking_policy; v_is_meeting boolean; v_student_allowed boolean; v_status public.booking_status;
 v_max_days integer; v_open time; v_close time; v_start_local timestamp; v_end_local timestamp; v_today date; v_meeting_dates date[];
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not (public.has_role('STUDENT') or public.has_role('TEACHER') or public.has_role('ADMIN')) then raise exception 'BOOKING_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED' using errcode='22023'; end if;
 select r.* into v_room from public.rooms r where r.id=p_room_id and r.active for share;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select rt.booking_policy,rt.student_booking_allowed,rt.usage_scope='MEETING' into v_policy,v_student_allowed,v_is_meeting from public.room_types rt where rt.id=v_room.room_type_id;
 if not v_room.booking_enabled then raise exception 'ROOM_BOOKING_DISABLED'; end if;
 select (rule_value#>>'{}')::integer into v_max_days from public.booking_rules where rule_key='MAX_ADVANCE_BOOKING_DAYS' and active;
 select (rule_value#>>'{}')::time into v_open from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and active;
 select (rule_value#>>'{}')::time into v_close from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active;
 v_max_days:=coalesce(v_max_days,3); v_open:=coalesce(v_open,'08:30'::time); v_close:=coalesce(v_close,'17:30'::time);
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok'; v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 v_today:=(now() at time zone 'Asia/Bangkok')::date;
 if v_is_meeting then
  v_policy := 'AUTO_CONFIRM';
  select p.allowed_dates,p.opens_at,p.closes_at into v_meeting_dates,v_open,v_close from public.get_meeting_booking_policy() p;
  if not coalesce(v_start_local::date=any(v_meeting_dates), false) then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 elsif v_start_local::date>v_today+v_max_days then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<v_open or v_end_local::time>v_close then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
 if not v_student_allowed and not (public.has_role('TEACHER') or public.has_role('ADMIN')) then raise exception 'COLD_ROOM_TEACHER_OR_ADMIN_ONLY' using errcode='42501'; end if;
 v_status:=case when v_policy='MANUAL_APPROVAL' then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if (v_is_meeting and public.meeting_room_has_pending_overlap(p_room_id,p_starts_at,p_ends_at))
 or exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,requires_key,notes,status)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes,v_status) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,v_status,v_actor,case when v_status='APPROVED' then 'Automatically confirmed by room policy' else 'Manual approval required by room policy' end);
 perform public.write_audit(v_actor,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id,'policy',v_policy,'status',v_status));
 perform public.create_notification(v_actor,case when v_status='APPROVED' then 'BOOKING_CONFIRMED' else 'BOOKING_SUBMITTED' end,case when v_status='APPROVED' then 'Booking confirmed' else 'Booking submitted' end,'Booking '||v_booking.booking_code||case when v_status='APPROVED' then ' is confirmed.' else ' is pending approval.' end,'booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.create_meeting_booking(
 p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_booking public.bookings;
 v_allowed_dates date[];v_open time;v_close time;v_start_local timestamp;v_end_local timestamp;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
 if nullif(btrim(p_purpose),'') is null or p_ends_at<=p_starts_at then raise exception 'INVALID_BOOKING_INPUT';end if;
 if not exists(select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=p_room_id and r.active and r.booking_enabled and rt.usage_scope='MEETING') then raise exception 'MEETING_ROOM_NOT_AVAILABLE';end if;
 select allowed_dates,opens_at,closes_at into v_allowed_dates,v_open,v_close from public.get_meeting_booking_policy();
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok';v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 if not coalesce(v_start_local::date = any(v_allowed_dates), false) then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED';end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<v_open or v_end_local::time>v_close then raise exception 'OUTSIDE_SERVICE_HOURS';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if public.meeting_room_has_pending_overlap(p_room_id,p_starts_at,p_ends_at)
 or exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then
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

create or replace function public.get_public_meeting_room_week(p_room_id uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_week date := v_today - extract(dow from v_today)::integer;
  v_from timestamptz;
  v_until timestamptz;
  v_can_view boolean;
  v_actor uuid := auth.uid();
  v_can_manage boolean := v_actor is not null and (public.has_permission('BOOKING_MANAGE') or public.has_permission('BOOKING_APPROVE'));
begin
  if p_week_start is null or p_week_start not in (v_week - 7, v_week, v_week + 7) then
    raise exception 'INVALID_MEETING_WEEK' using errcode = '22023';
  end if;

  select case when auth.uid() is null then coalesce(p.guest_view_schedule, true)
    when public.has_role('STUDENT') then coalesce(p.student_view_schedule, true)
    else true end into v_can_view
  from public.rooms r
  join public.room_types t on t.id = r.room_type_id
  left join public.room_usage_policies p on p.room_id = r.id
  where r.id = p_room_id and r.active and t.usage_scope = 'MEETING';

  if not coalesce(v_can_view, false) then
    raise exception 'SCHEDULE_POLICY_DENIED' using errcode = '42501';
  end if;

  v_from := p_week_start::timestamp at time zone 'Asia/Bangkok';
  v_until := (p_week_start + 7)::timestamp at time zone 'Asia/Bangkok';

  return (
    with events as (
      select b.starts_at, b.ends_at, case
        when b.is_priority or 'DEAN' = any(actor.roles) or 'DEPARTMENT_HEAD' = any(actor.roles) then 'LEADERSHIP'
        when 'TEACHER' = any(actor.roles) then 'TEACHER'
        else 'OTHER'
      end as category,
        case when v_can_manage or b.requester_id = v_actor then p.full_name end as requester_name,
        case when v_can_manage or b.requester_id = v_actor then b.purpose end as purpose
      from public.bookings b
      join public.profiles p on p.id = b.requester_id
      cross join lateral (
        select array_agg(r.code) as roles
        from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = b.requester_id
      ) actor
      where b.room_id = p_room_id and b.status in ('PENDING', 'APPROVED', 'IN_USE', 'COMPLETED')
        and b.starts_at < v_until and b.ends_at > v_from
      union all
      select rb.starts_at, rb.ends_at, 'BLOCK', null::text, null::text
      from public.room_blocks rb
      where rb.room_id = p_room_id and rb.starts_at < v_until and rb.ends_at > v_from
    )
    select jsonb_build_object(
      'viewer_id', v_actor,
      'opens_at', hours.opens_at,
      'closes_at', hours.closes_at,
      'events', coalesce((select jsonb_agg(jsonb_strip_nulls(to_jsonb(e)) order by e.starts_at, e.ends_at, e.category)
        from events e), '[]'::jsonb)
    ) from public.meeting_room_operating_hours() hours
  );
end;
$$;

revoke all on function public.get_public_meeting_room_week(uuid, date) from public;
grant execute on function public.get_public_meeting_room_week(uuid, date) to anon, authenticated;

