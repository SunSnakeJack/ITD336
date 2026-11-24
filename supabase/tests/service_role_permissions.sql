begin;
do $$
declare
 v_admin uuid := gen_random_uuid(); v_student uuid := gen_random_uuid();
 v_general uuid := gen_random_uuid(); v_special uuid := gen_random_uuid(); v_meeting uuid := gen_random_uuid();
 v_day date := (now() at time zone 'Asia/Bangkok')::date;
 v_start timestamptz := (v_day+time '08:00') at time zone 'Asia/Bangkok';
 v_request jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
  (v_admin,'permissions-admin@northbkk.ac.th','{"full_name":"Permissions Admin"}'),
  (v_student,'permissions-student@northbkk.ac.th','{"full_name":"Permissions Student"}');
 insert into public.user_roles(user_id,role_id)
 select v_admin,id from public.roles where code='ADMIN' union all select v_student,id from public.roles where code='STUDENT';
 insert into public.rooms(id,code,layout_key,name,room_type_id,capacity)
 select v.id,v.code,v.code,v.code,rt.id,20 from (values
  (v_general,'TEST-SERVICE-GENERAL','COMPUTER'),(v_special,'TEST-SERVICE-SPECIAL','STUDIO'),
  (v_meeting,'TEST-SERVICE-MEETING','MEETING')) v(id,code,type_code) join public.room_types rt on rt.code=v.type_code;
 insert into public.system_settings(setting_key,setting_value,description)
 values('ALLOW_PAST_KEY_REQUEST_SLOTS','true','Test setting'),('OPEN_SATURDAY',to_jsonb(v_day),'Test setting')
 on conflict(setting_key) do update set setting_value=excluded.setting_value;
 insert into public.room_category_restrictions(category,policy) values('LAB','{}'),('SPECIAL','{}'),('MEETING','{}')
 on conflict(category) do update set policy=excluded.policy;

 perform set_config('request.jwt.claim.sub','',true);
 assert public.get_viewer_permissions()=array['KEY_REQUEST_GENERAL'];
 v_request := public.create_key_request(v_general,'Guest test','permissions-guest@northbkk.ac.th','OTHER','Guest test',v_start,v_start+interval '30 minutes');
 assert v_request->>'id' is not null;

 perform set_config('request.jwt.claim.sub',v_student::text,true);
 assert public.get_viewer_permissions() @> array['KEY_REQUEST_GENERAL','KEY_REQUEST_SPECIAL'];
 assert not public.get_viewer_permissions() && array['MEETING_BOOK','BOOKING_OVERRIDE','STAFF_ACCESS'];
 v_request := public.create_key_request(v_special,'Student test','permissions-student@northbkk.ac.th','OTHER','Special test',v_start,v_start+interval '30 minutes');
 assert v_request->>'id' is not null;
 assert v_request->>'status'='PENDING_APPROVAL';
 begin
  insert into public.bookings(requester_id,created_by,room_id,starts_at,ends_at,purpose,status)
  values(v_student,v_student,v_meeting,v_start,v_start+interval '30 minutes','Denied meeting','APPROVED');
  raise exception 'Student could book a meeting room';
 exception when insufficient_privilege then assert sqlerrm='MEETING_BOOKING_ROLE_REQUIRED';
 end;

 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 perform public.save_permission_settings_v2('{"guestGeneralKey":false,"roleGrants":[{"role":"STUDENT","permission":"KEY_REQUEST_SPECIAL","enabled":false}]}');
 perform set_config('request.jwt.claim.sub',v_student::text,true);
 begin
  perform public.create_key_request(v_special,'Student test','permissions-student@northbkk.ac.th','OTHER','Denied test',v_start+interval '1 hour',v_start+interval '90 minutes');
  raise exception 'Revoked special-room permission was accepted';
 exception when insufficient_privilege then assert sqlerrm='KEY_REQUEST_PERMISSION_REQUIRED';
 end;
 perform set_config('request.jwt.claim.sub','',true);
 assert cardinality(public.get_viewer_permissions())=0;
 begin
  perform public.create_key_request(v_general,'Guest test','permissions-guest@northbkk.ac.th','OTHER','Denied test',v_start+interval '1 hour',v_start+interval '90 minutes');
  raise exception 'Revoked guest permission was accepted';
 exception when insufficient_privilege then assert sqlerrm='KEY_REQUEST_PERMISSION_REQUIRED';
 end;
end $$;
rollback;
