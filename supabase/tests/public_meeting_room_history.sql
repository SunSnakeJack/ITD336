-- Run on a disposable database with the standard seed.
begin;
do $$
declare
  v_room uuid := (select id from public.rooms where code = 'MEET-FACULTY');
  v_lab uuid := (select id from public.rooms where code = 'S2407');
begin
  assert v_room is not null and v_lab is not null, 'Meeting and lab seed required';
  assert has_function_privilege('anon', 'public.get_public_meeting_room_history(uuid)', 'execute');
  perform set_config('request.jwt.claim.sub', '', true);
  assert (select count(*) <= 5 and not coalesce(bool_or(ends_at > now()), false)
    from public.get_public_meeting_room_history(v_room));
  begin
    perform public.get_public_meeting_room_history(v_lab);
    raise exception 'Meeting history exposed a laboratory';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
