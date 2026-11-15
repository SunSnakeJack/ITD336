-- Run on a disposable local database with the standard seed.
begin;
do $$
declare
  v_room uuid := (select id from public.rooms where code = 'MEET-FACULTY');
  v_owner uuid := '10000000-0000-0000-0000-000000000002';
  v_other uuid := '10000000-0000-0000-0000-000000000005';
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_week date := v_today - extract(dow from v_today)::integer;
  v_start timestamptz := (v_week + time '04:01') at time zone 'Asia/Bangkok';
  v_end timestamptz := v_start + interval '1 minute';
  v_event jsonb;
begin
  assert v_room is not null, 'Meeting room seed required';
  insert into public.bookings(room_id, requester_id, starts_at, ends_at, status, purpose)
  values (v_room, v_owner, v_start, v_end, 'COMPLETED', 'Private meeting purpose');

  perform set_config('request.jwt.claim.sub', '', true);
  select e into strict v_event from jsonb_array_elements(public.get_public_meeting_room_week(v_room, v_week)->'events') e
    where (e->>'starts_at')::timestamptz = v_start;
  assert not (v_event ?| array['requester_name', 'purpose']), 'Guest saw private booking details';

  perform set_config('request.jwt.claim.sub', v_other::text, true);
  select e into strict v_event from jsonb_array_elements(public.get_public_meeting_room_week(v_room, v_week)->'events') e
    where (e->>'starts_at')::timestamptz = v_start;
  assert not (v_event ?| array['requester_name', 'purpose']), 'Other user saw private booking details';

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  select e into strict v_event from jsonb_array_elements(public.get_public_meeting_room_week(v_room, v_week)->'events') e
    where (e->>'starts_at')::timestamptz = v_start;
  assert v_event->>'purpose' = 'Private meeting purpose' and v_event ? 'requester_name', 'Owner could not see private booking details';
end;
$$;
rollback;
