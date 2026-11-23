begin;
do $$
declare
 v_admin uuid := gen_random_uuid();
 v_room uuid := gen_random_uuid();
 v_type uuid;
 v_start timestamptz := '2027-01-04 10:00:00+07';
begin
 insert into auth.users(id,email) values(v_admin,'room-policy-admin@example.test');
 insert into public.user_roles(user_id,role_id)
 select v_admin,id from public.roles where code='ADMIN';
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select id into strict v_type from public.room_types where code='COMPUTER';
 insert into public.rooms(id,code,layout_key,name,room_type_id,capacity)
 values(v_room,'TEST-POLICY','test-layout-policy','Policy test',v_type,20);
 perform public.save_permission_settings_v2('{"roomPolicies":{"LAB":{"minMinutes":60},"SPECIAL":{"minMinutes":90}}}');
 assert (public.get_room_category_restrictions()->'LAB'->>'minMinutes')::integer=60;
 assert (public.get_room_category_restrictions()->'SPECIAL'->>'minMinutes')::integer=90;
 begin
  insert into public.bookings(requester_id,room_id,starts_at,ends_at,purpose)
  values(v_admin,v_room,v_start,v_start+interval '30 minutes','Policy test');
  raise exception 'Short booking accepted';
 exception when raise_exception then
  assert sqlerrm='ROOM_REQUEST_DURATION_OUT_OF_RANGE';
 end;
end $$;
rollback;
