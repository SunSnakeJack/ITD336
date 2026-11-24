begin;
do $$
declare
 v_admin uuid := gen_random_uuid();
 v_room uuid := gen_random_uuid();
 v_meeting uuid := gen_random_uuid();
 v_booking uuid;
 v_type uuid;
 v_start timestamptz := (date_trunc('week',now() at time zone 'Asia/Bangkok') + interval '7 days 10 hours') at time zone 'Asia/Bangkok';
begin
 insert into auth.users(id,email) values(v_admin,'room-policy-admin@example.test');
 insert into public.user_roles(user_id,role_id)
 select v_admin,id from public.roles where code='ADMIN';
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select id into strict v_type from public.room_types where code='COMPUTER';
 insert into public.rooms(id,code,layout_key,name,room_type_id,capacity)
 values(v_room,'TEST-POLICY','test-layout-policy','Policy test',v_type,20);
 select id into strict v_type from public.room_types where code='MEETING';
 insert into public.rooms(id,code,layout_key,name,room_type_id,capacity)
 values(v_meeting,'TEST-SLOT-MEETING','test-slot-meeting','Meeting slot test',v_type,20);
 perform public.save_permission_settings_v2('{"roomPolicies":{"LAB":{"slotMinutes":20,"minMinutes":60,"maxMinutes":90},"SPECIAL":{},"MEETING":{"opensAt":"08:00","closesAt":"17:10","slotMinutes":20}}}');
 assert (public.get_room_category_restrictions()->'LAB'->>'slotMinutes')::integer=20;
 assert not (public.get_room_category_restrictions()->'LAB' ?| array['minMinutes','maxMinutes']);
 assert public.room_category_slot_minutes('SPECIAL')=30;
 assert exists(select 1 from public.get_public_room_slot_policies() where room_id=v_room and slot_minutes=20);
 assert exists(select 1 from public.get_public_room_slot_policies() where room_id=v_meeting and closes_at=time '17:10' and slot_minutes=20);
 assert has_function_privilege('anon','public.get_public_room_slot_policies()','EXECUTE');
 assert not has_function_privilege('anon','public.room_category_slot_minutes(text)','EXECUTE');
 assert public.is_room_slot_range(time '08:05',time '09:05',time '08:05',time '09:15',20);
 assert not public.is_room_slot_range(time '08:05',time '09:15',time '08:05',time '09:15',20);
 assert not public.is_room_slot_range(time '08:15',time '08:35',time '08:05',time '09:15',20);
 insert into public.key_requests(room_id,requester_name,requester_email,purpose_type,purpose,starts_at,ends_at,status,approval_mode)
 values(v_room,'Policy test','policy-test@northbkk.ac.th','OTHER','Policy test',v_start,v_start+interval '20 minutes','APPROVED','AUTO');
 begin
  insert into public.key_requests(room_id,requester_name,requester_email,purpose_type,purpose,starts_at,ends_at,status,approval_mode)
  values(v_room,'Policy test','policy-test@northbkk.ac.th','OTHER','Policy test',v_start+interval '1 hour',v_start+interval '90 minutes','APPROVED','AUTO');
  raise exception 'Off-grid request accepted';
 exception when invalid_parameter_value then
  assert sqlerrm='INVALID_ROOM_SLOT_RANGE';
 end;
 insert into public.bookings(requester_id,created_by,room_id,starts_at,ends_at,purpose,status)
 values(v_admin,v_admin,v_meeting,v_start,v_start+interval '20 minutes','Meeting slot test','APPROVED')
 returning id into v_booking;
 perform public.reschedule_own_request(v_booking,'booking',v_start+interval '20 minutes',v_start+interval '40 minutes','Rescheduled');
 assert (public.get_own_request_edit_times(v_booking,'booking')->>'slotMinutes')::integer=20;
 perform public.save_permission_settings_v2('{"roomPolicies":{"MEETING":{"slotMinutes":30}}}');
 perform public.reschedule_own_request(v_booking,'booking',v_start+interval '20 minutes',v_start+interval '40 minutes','Changed purpose');
 assert exists(select 1 from public.bookings where id=v_booking and purpose='Changed purpose'
  and starts_at=v_start+interval '20 minutes' and ends_at=v_start+interval '40 minutes');
end $$;
rollback;
