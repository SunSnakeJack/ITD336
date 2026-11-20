begin;

do $$
begin
  assert has_function_privilege('anon', 'public.get_show_elapsed_room_slots()', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.set_show_elapsed_room_slots(boolean)', 'EXECUTE');

  delete from public.booking_rules where rule_key = 'SHOW_ELAPSED_ROOM_SLOTS';
  assert public.get_show_elapsed_room_slots() is true;
  insert into public.booking_rules(rule_key, rule_value, description, active)
  values ('SHOW_ELAPSED_ROOM_SLOTS', 'false'::jsonb, 'Display test', true);
  assert public.get_show_elapsed_room_slots() is false;
end $$;

rollback;
