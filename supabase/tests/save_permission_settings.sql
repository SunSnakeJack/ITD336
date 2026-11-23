begin;
do $$
declare
 v_admin uuid := gen_random_uuid();
 v_user uuid := gen_random_uuid();
 v_before boolean;
 v_change jsonb;
begin
 insert into auth.users(id,email) values
  (v_admin,'permissions-batch-admin@example.test'),(v_user,'permissions-batch-user@example.test');
 insert into public.user_roles(user_id,role_id)
 select v_admin,id from public.roles where code='ADMIN';
 select exists(
  select 1 from public.role_permissions rp
  join public.roles r on r.id=rp.role_id
  join public.permissions p on p.id=rp.permission_id
  where r.code='STAFF' and p.code='ROOM_MANAGE'
 ) into v_before;
 v_change := jsonb_build_object('roleGrants',jsonb_build_array(
  jsonb_build_object('role','STAFF','permission','ROOM_MANAGE','enabled',not v_before)
 ));
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 begin
  perform public.save_permission_settings(v_change);
  raise exception 'Unauthorized change succeeded';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 begin
  perform public.save_permission_settings(v_change || '{"meetingAdvanceDays":0}'::jsonb);
  raise exception 'Invalid advance days accepted';
 exception when invalid_parameter_value then
  assert sqlerrm='INVALID_MEETING_ADVANCE_BOOKING_DAYS';
 end;
 assert v_before = exists(
  select 1 from public.role_permissions rp
  join public.roles r on r.id=rp.role_id
  join public.permissions p on p.id=rp.permission_id
  where r.code='STAFF' and p.code='ROOM_MANAGE'
 );
 perform public.save_permission_settings(v_change || '{"meetingAdvanceDays":5}'::jsonb);
 assert public.get_meeting_advance_booking_days()=5;
 assert exists(select 1 from public.audit_logs where actor_id=v_admin and action='ROLE_PERMISSION_UPDATED');
end $$;
rollback;
