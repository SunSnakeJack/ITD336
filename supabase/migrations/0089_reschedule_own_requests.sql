create function public.get_own_request_edit_context(p_id uuid, p_type text)
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
      case when rt.usage_scope = 'MEETING' then time '08:00' else coalesce(
        (select (rule_value #>> '{}')::time from public.booking_rules where rule_key = 'GENERAL_OPEN_TIME' and active), time '08:30') end,
      case when rt.usage_scope = 'MEETING' then time '18:00' else coalesce(
        (select (rule_value #>> '{}')::time from public.booking_rules where rule_key = 'GENERAL_CLOSE_TIME' and active), time '17:30') end
    from public.bookings b
    join public.rooms r on r.id = b.room_id and r.active and r.booking_enabled
    join public.room_types rt on rt.id = r.room_type_id
    where b.id = p_id and b.requester_id = v_actor and b.starts_at > now()
      and b.status in ('PENDING', 'APPROVED');
  elsif p_type = 'key_request' then
    return query
    select k.room_id, (k.starts_at at time zone 'Asia/Bangkok')::date, time '08:00', time '18:00'
    from public.key_requests k join public.rooms r on r.id = k.room_id and r.active
    where k.id = p_id and k.starts_at > now() and k.status in ('PENDING_APPROVAL', 'APPROVED')
      and (k.authenticated_user_id = v_actor or (k.authenticated_user_id is null and exists (
        select 1 from auth.users u where u.id = v_actor and u.email_confirmed_at is not null
          and lower(u.email) = lower(k.requester_email)
      )));
  end if;
end;
$$;

create function public.get_own_request_edit_times(p_id uuid, p_type text)
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
    'closesAt', v_context.closes_at, 'intervals', v_intervals);
end;
$$;

create function public.reschedule_own_request(
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
     or v_start::time < v_context.opens_at or v_end::time > v_context.closes_at
     or extract(minute from v_start)::int % 30 <> 0 or extract(minute from v_end)::int % 30 <> 0
     or extract(second from v_start) <> 0 or extract(second from v_end) <> 0 then
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

revoke all on function public.get_own_request_edit_context(uuid, text),
  public.get_own_request_edit_times(uuid, text),
  public.reschedule_own_request(uuid, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.get_own_request_edit_times(uuid, text),
  public.reschedule_own_request(uuid, text, timestamptz, timestamptz, text) to authenticated;
