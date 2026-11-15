-- Run against a disposable local database with the standard seed.
begin;
do $$
declare
  v_room uuid := (select id from public.rooms where code = 'MEET-FACULTY');
  v_teacher uuid := '10000000-0000-0000-0000-000000000002';
  v_admin uuid := '10000000-0000-0000-0000-000000000004';
  v_priority uuid := '10000000-0000-0000-0000-000000000005';
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_day date;
  v_starts timestamptz;
  v_ends timestamptz;
  v_result jsonb;
  v_second jsonb;
  v_week jsonb;
  v_override jsonb;
  v_today_start timestamptz;
begin
  assert v_room is not null, 'Meeting room seed required';
  update public.room_types set booking_policy = 'MANUAL_APPROVAL', report_category = null, usage_scope = 'MEETING'
    where id = (select room_type_id from public.rooms where id = v_room);
  insert into public.user_roles(user_id, role_id)
    select v_teacher, id from public.roles where code = 'STUDENT' on conflict do nothing;

  perform set_config('request.jwt.claim.sub', v_teacher::text, true);
  select min(day) into v_day from public.get_meeting_booking_policy() p
    cross join unnest(p.allowed_dates) day where day > v_today;
  assert v_day is not null, 'At least one booking date is required';
  v_starts := (v_day + time '08:00') at time zone 'Asia/Bangkok';
  v_ends := (v_day + time '18:00') at time zone 'Asia/Bangkok';
  v_result := public.create_booking(v_room, v_starts, v_starts + interval '30 minutes', 'Opening slot');
  v_second := public.create_booking(v_room, v_ends - interval '30 minutes', v_ends, 'Closing slot');
  assert v_result->>'status' = 'APPROVED' and v_second->>'status' = 'APPROVED', 'Meeting bookings must auto-confirm';
  assert (select status = 'APPROVED' from public.bookings where id = (v_result->>'id')::uuid);

  v_today_start := greatest(now() + interval '1 minute', (v_today + time '08:00') at time zone 'Asia/Bangkok');
  if v_today_start + interval '30 minutes' <= ((v_today + time '18:00') at time zone 'Asia/Bangkok')
    and exists (select 1 from public.get_meeting_booking_policy() where v_today = any(allowed_dates)) then
    assert public.create_booking(v_room, v_today_start, v_today_start + interval '30 minutes', 'Same day')->>'status' = 'APPROVED';
  end if;

  v_week := public.get_public_meeting_room_week(v_room, v_day - extract(dow from v_day)::integer);
  assert (v_week->>'opens_at')::time = time '08:00' and (v_week->>'closes_at')::time = time '18:00';

  begin
    perform public.create_booking(v_room, v_starts, v_starts + interval '30 minutes', 'Conflicting slot');
    raise exception 'Overlapping meeting booking was accepted';
  exception when exclusion_violation then null;
  end;
  begin
    perform public.create_booking(v_room, v_ends, v_ends + interval '30 minutes', 'Out of hours');
    raise exception 'Outside-hours booking was accepted';
  exception when raise_exception then
    if sqlerrm <> 'OUTSIDE_OPERATING_HOURS' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  assert exists (select 1 from public.get_staff_usage_history()
    where transaction_id = 'booking:' || (v_result->>'id') and status = 'APPROVED' and room_category = 'MEETING'),
    'The confirmed booking was missing from the staff dashboard feed';

  perform set_config('request.jwt.claim.sub', v_priority::text, true);
  begin
    perform public.create_booking(v_room, v_starts, v_ends, 'Spans two existing bookings');
    raise exception 'Override displaced multiple existing bookings';
  exception when exclusion_violation then null;
  end;
  assert (select status = 'APPROVED' from public.bookings where id = (v_result->>'id')::uuid),
    'A failed override must leave the original booking intact';
  v_override := public.create_booking(v_room, v_starts + interval '15 minutes',
    v_starts + interval '45 minutes', 'Priority slot', true);
  assert v_override->>'status' = 'APPROVED';
  assert (select is_priority and requires_key from public.bookings where id = (v_override->>'id')::uuid);
  assert (select status = 'SUPERSEDED' and superseded_by_booking_id = (v_override->>'id')::uuid
    from public.bookings where id = (v_result->>'id')::uuid);
  assert exists (select 1 from public.bookings where origin_booking_id = (v_result->>'id')::uuid
    and status = 'APPROVED' and starts_at = v_starts and ends_at = v_starts + interval '15 minutes');
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  assert exists (select 1 from public.get_staff_usage_history() where transaction_id = 'booking:' || (v_override->>'id'));
  assert not exists (select 1 from public.get_staff_usage_history() where transaction_id = 'booking:' || (v_result->>'id'));
end;
$$;
rollback;
