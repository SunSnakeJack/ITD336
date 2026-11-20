-- Run on a development database with the standard roles and room types.
begin;
do $$
declare
 v_admin uuid := gen_random_uuid();
 v_user uuid := gen_random_uuid();
 v_room uuid := gen_random_uuid();
 v_other_room uuid := gen_random_uuid();
 v_type uuid;
 v_future timestamptz := (date_trunc('week', now() at time zone 'Asia/Bangkok') + interval '7 days 9 hours') at time zone 'Asia/Bangkok';
begin
 assert not has_function_privilege('anon','public.staff_confirm_overdue_key_returns(uuid,integer)','EXECUTE');
 assert has_function_privilege('authenticated','public.staff_confirm_overdue_key_returns(uuid,integer)','EXECUTE');
 insert into auth.users(id,email) values
  (v_admin,'verify-return-admin@example.test'),(v_user,'verify-return-user@example.test');
 insert into public.user_roles(user_id,role_id)
 select v_admin,id from public.roles where code='ADMIN' on conflict do nothing;
 select id into strict v_type from public.room_types where code='COMPUTER';
 insert into public.rooms(id,code,name,room_type_id,capacity) values
  (v_room,'TEST-VERIFY-KEY','Test room',v_type,20),
  (v_other_room,'TEST-VERIFY-OTHER','Other room',v_type,20);
 insert into public.system_settings(setting_key,setting_value)
 values('ALLOW_PAST_KEY_REQUEST_SLOTS','true'::jsonb)
 on conflict(setting_key) do update set setting_value=excluded.setting_value;
 insert into public.key_requests(room_id,requester_name,requester_email,purpose_type,purpose,starts_at,ends_at,status,approval_mode)
 select room_id,'Test borrower','verify-return@northbkk.ac.th','OTHER','Test key return',starts_at,starts_at+interval '30 minutes',status,'AUTO'
 from (values
  (v_room,'2024-01-08 09:00+07'::timestamptz,'APPROVED'),
  (v_room,'2024-01-08 10:00+07'::timestamptz,'IN_USE'),
  (v_room,'2024-01-08 11:00+07'::timestamptz,'PENDING_APPROVAL'),
  (v_room,v_future,'APPROVED'),
  (v_other_room,'2024-01-08 09:00+07'::timestamptz,'APPROVED')
 ) as fixtures(room_id,starts_at,status);

 perform set_config('request.jwt.claim.sub',v_user::text,true);
 begin
  perform public.staff_confirm_overdue_key_returns(v_room,2);
  raise exception 'Regular user confirmed receipt';
 exception when insufficient_privilege then null;
 end;

 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 assert public.staff_confirm_overdue_key_returns(v_room,null)=2;
 assert not exists(select 1 from public.key_requests where room_id=v_room and returned_at is not null);
 begin
  perform public.staff_confirm_overdue_key_returns(v_room,1);
  raise exception 'Stale count was accepted';
 exception when raise_exception then
  assert sqlerrm='OVERDUE_RETURN_SET_CHANGED';
 end;
 assert not exists(select 1 from public.key_requests where room_id=v_room and returned_at is not null);
 assert public.staff_confirm_overdue_key_returns(v_room,2)=2;
 assert public.staff_confirm_overdue_key_returns(v_room,2)=0;
 assert (select count(*) from public.get_staff_usage_history() where room_id=v_room and status='RETURNED_VERIFIED')=2;
 assert (select count(*) from public.key_request_status_history h join public.key_requests k on k.id=h.key_request_id
  where k.room_id=v_room and h.new_status='RETURNED' and h.actor_user_id=v_admin and h.actor_kind='ADMIN')=2;
 assert (select count(*) from public.key_requests where room_id=v_room and returned_at is null)=2;
 assert not exists(select 1 from public.key_requests where room_id=v_other_room and returned_at is not null);
end $$;
rollback;
