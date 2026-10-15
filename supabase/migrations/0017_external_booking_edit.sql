-- Make exact-time availability checks aware of recurring academic schedules,
-- and allow authorized administrators to edit external-party bookings safely.
create or replace function public.check_room_availability(
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_booking_id uuid default null
)
returns table(available boolean, conflict_type text, conflict_id uuid, conflict_description text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME_RANGE' using errcode = '22007';
  end if;
  return query
  with requested_days as (
    select day::date occurrence_date
    from pg_catalog.generate_series(
      (p_starts_at at time zone 'Asia/Bangkok')::date,
      ((p_ends_at - interval '1 microsecond') at time zone 'Asia/Bangkok')::date,
      interval '1 day'
    ) day
  ), conflicts as (
    select 'BOOKING'::text kind,
      case when public.has_permission('BOOKING_READ_ALL') or b.requester_id = auth.uid() then b.id else null::uuid end conflict_id,
      case when public.has_permission('BOOKING_READ_ALL') or b.requester_id = auth.uid() then b.booking_code else 'Existing booking' end description
    from public.bookings b
    where b.room_id = p_room_id
      and b.status in ('APPROVED', 'IN_USE')
      and b.id is distinct from p_exclude_booking_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    union all
    select 'CLASS_SCHEDULE', c.id, c.course_code || ' · ' || c.subject_name
    from public.class_schedules c
    join requested_days d
      on d.occurrence_date between c.effective_from and c.effective_until
      and extract(dow from d.occurrence_date)::smallint = c.day_of_week
    where c.room_id = p_room_id
      and c.active
      and c.status = 'ACTIVE'
      and tstzrange(
        (d.occurrence_date + c.start_time) at time zone 'Asia/Bangkok',
        (d.occurrence_date + c.end_time) at time zone 'Asia/Bangkok',
        '[)'
      ) && tstzrange(p_starts_at, p_ends_at, '[)')
    union all
    select 'ROOM_BLOCK', rb.id, rb.reason
    from public.room_blocks rb
    where rb.room_id = p_room_id
      and tstzrange(rb.starts_at, rb.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  )
  select false, c.kind, c.conflict_id, c.description from conflicts c
  union all
  select true, null::text, null::uuid, null::text
  where not exists(select 1 from conflicts);
end
$$;

create or replace function public.get_external_booking_for_edit(p_booking_id uuid)
returns table(booking_id uuid, external_name text, reason text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('BOOKING_CREATE_FOR_OTHERS') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select b.id, e.full_name, b.purpose, b.starts_at, b.ends_at
  from public.bookings b
  join public.external_parties e on e.id = b.external_party_id
  where b.id = p_booking_id and b.status = 'APPROVED';
end
$$;

create or replace function public.update_external_booking(
  p_booking_id uuid,
  p_external_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings;
  v_before jsonb;
begin
  if not public.has_permission('BOOKING_CREATE_FOR_OTHERS') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(btrim(p_external_name), '') is null or nullif(btrim(p_reason), '') is null then
    raise exception 'EXTERNAL_PERSON_AND_REASON_REQUIRED';
  end if;
  if p_ends_at <= p_starts_at or p_starts_at <= now() then
    raise exception 'INVALID_TIME_RANGE';
  end if;
  if (p_starts_at at time zone 'Asia/Bangkok')::date <> (p_ends_at at time zone 'Asia/Bangkok')::date then
    raise exception 'BOOKING_MUST_END_SAME_DAY';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.external_party_id is null then
    raise exception 'EXTERNAL_BOOKING_NOT_FOUND';
  end if;
  if v_booking.status <> 'APPROVED' then
    raise exception 'EXTERNAL_BOOKING_NOT_EDITABLE';
  end if;
  v_before := to_jsonb(v_booking);
  perform pg_advisory_xact_lock(hashtextextended(v_booking.room_id::text, 0));
  if exists(
    select 1 from public.check_room_availability(v_booking.room_id, p_starts_at, p_ends_at, p_booking_id)
    where not available
  ) then
    raise exception 'ROOM_UNAVAILABLE' using errcode = '23P01';
  end if;

  update public.external_parties
  set full_name = btrim(p_external_name)
  where id = v_booking.external_party_id;
  update public.bookings
  set starts_at = p_starts_at, ends_at = p_ends_at, purpose = btrim(p_reason), notes = btrim(p_reason)
  where id = p_booking_id;
  insert into public.booking_status_history(booking_id, previous_status, new_status, changed_by, reason)
  values(p_booking_id, 'APPROVED', 'APPROVED', v_actor, 'External booking details updated');
  perform public.write_audit(
    v_actor,
    'EXTERNAL_BOOKING_UPDATED',
    'booking',
    p_booking_id,
    jsonb_build_object('before', v_before, 'external_name', btrim(p_external_name), 'reason', btrim(p_reason), 'starts_at', p_starts_at, 'ends_at', p_ends_at)
  );
  return jsonb_build_object('id', p_booking_id, 'booking_code', v_booking.booking_code, 'status', 'APPROVED');
end
$$;

revoke all on function public.get_external_booking_for_edit(uuid), public.update_external_booking(uuid, text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_external_booking_for_edit(uuid), public.update_external_booking(uuid, text, timestamptz, timestamptz, text) to authenticated;
