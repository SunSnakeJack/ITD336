-- Run on a disposable database with the standard seed.
begin;

do $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_week date := v_today - extract(dow from v_today)::integer;
  v_room uuid := (select id from public.rooms where code = 'MEET-FACULTY');
  v_lab uuid := (select id from public.rooms where code = 'S2407');
  v_calendar jsonb;
  v_event jsonb;
begin
  assert v_room is not null and v_lab is not null, 'Meeting and lab seed required';
  assert has_function_privilege('anon', 'public.get_public_meeting_room_week(uuid,date)', 'execute');
  perform set_config('request.jwt.claim.sub', '', true);
  v_calendar := public.get_public_meeting_room_week(v_room, v_week - 7);
  assert jsonb_typeof(v_calendar -> 'events') = 'array';
  for v_event in select value from jsonb_array_elements(v_calendar -> 'events') loop
    assert v_event - 'starts_at' - 'ends_at' - 'category' = '{}'::jsonb, 'Unexpected public fields';
  end loop;
  perform public.get_public_meeting_room_week(v_room, v_week + 7);

  begin
    perform public.get_public_meeting_room_week(v_room, v_week + 14);
    raise exception 'Calendar exposed a week outside the display window';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.get_public_meeting_room_week(v_lab, v_week);
    raise exception 'Meeting calendar exposed a laboratory';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
