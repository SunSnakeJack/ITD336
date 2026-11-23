begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_room uuid;
  v_other uuid;
  v_type uuid;
begin
  insert into auth.users(id,email) values (v_admin,'room-code-case-admin@example.test');
  insert into public.user_roles(user_id,role_id)
  select v_admin,id from public.roles where code='ADMIN' on conflict do nothing;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  select id into strict v_type from public.room_types where code='COMPUTER';

  v_room := public.save_admin_room(null,'  Test-Learning  ','Test room',v_type,null,null,null,20,null,true,true,null,null,null);
  assert (select code from public.rooms where id=v_room) = 'Test-Learning';
  perform public.save_admin_room(v_room,'Test-learning','Test room',v_type,null,null,null,20,null,true,true,null,null,null);
  assert (select code from public.rooms where id=v_room) = 'Test-learning';
  assert public.update_room_details_v2(v_room,'  test-Learning  ','Test room',20,true);
  assert (select code from public.rooms where id=v_room) = 'test-Learning';

  begin
    perform public.save_admin_room(null,'TEST-LEARNING','Duplicate',v_type,null,null,null,20,null,true,true,null,null,null);
    raise exception 'Duplicate room code was accepted';
  exception when unique_violation then
    assert sqlerrm = 'ROOM_CODE_ALREADY_EXISTS';
  end;

  v_other := public.save_admin_room(null,'Another-Test-Room','Other room',v_type,null,null,null,20,null,true,true,null,null,null);
  begin
    perform public.update_room_details_v2(v_other,'TEST-LEARNING','Other room',20,true);
    raise exception 'Duplicate room code was accepted on edit';
  exception when unique_violation then
    assert sqlerrm = 'ROOM_CODE_ALREADY_EXISTS';
  end;
end $$;
rollback;
