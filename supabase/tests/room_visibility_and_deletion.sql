begin;
do $$
declare
 v_admin uuid := gen_random_uuid();
 v_member uuid := gen_random_uuid();
 v_type uuid;
 v_room uuid;
 v_referenced uuid;
begin
 insert into auth.users(id,email) values
  (v_admin,'room-visibility-admin@example.test'), (v_member,'room-visibility-member@example.test');
 insert into public.user_roles(user_id,role_id)
 select v_admin,id from public.roles where code='ADMIN';
 select id into strict v_type from public.room_types where code='COMPUTER';
 perform set_config('request.jwt.claim.sub',v_admin::text,true);

 v_room := public.save_admin_room(null,'test-room-visibility','Test room',v_type,null,null,null,1,null,false,true,null,null,null);
 perform public.save_admin_room_v2(v_room,'test-room-visibility','Test room',v_type,null,null,null,1,null,false,true,null,null,null,'[]');
 assert not exists(select 1 from public.get_public_room_catalog() where id=v_room);
 assert (select active and not booking_enabled and not visible_on_web from public.rooms where id=v_room);
 perform public.save_admin_room_v2(v_room,'test-room-visibility','Test room',v_type,null,null,null,1,null,true,false,null,null,null,'[]');
 assert exists(select 1 from public.get_public_room_catalog() where id=v_room and not active);

 v_referenced := public.save_admin_room_v2(null,'test-room-referenced','Referenced room',v_type,null,null,null,1,null,true,false,null,null,null,'[]');
 insert into public.room_blocks(room_id,starts_at,ends_at,reason,created_by)
 values(v_referenced,now(),now()+interval '1 hour','Test reference',v_admin);
 begin
  perform public.delete_admin_room(v_referenced);
  raise exception 'Referenced room was deleted';
 exception when foreign_key_violation then
  assert sqlerrm='ROOM_HAS_REFERENCES';
 end;
 perform set_config('request.jwt.claim.sub',v_member::text,true);
 begin
  perform public.delete_admin_room(v_room);
  raise exception 'Unprivileged account deleted a room';
 exception when insufficient_privilege then
  assert sqlerrm='FORBIDDEN';
 end;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 assert public.delete_admin_room(v_room)=v_room;
 assert not exists(select 1 from public.rooms where id=v_room);
 assert exists(select 1 from public.audit_logs where action='ROOM_DELETED' and entity_id=v_room);
end $$;
rollback;
