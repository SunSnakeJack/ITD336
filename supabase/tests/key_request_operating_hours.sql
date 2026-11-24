begin;

do $$
declare
 regular_room uuid := gen_random_uuid();
 special_room uuid := gen_random_uuid();
 hidden_room uuid := gen_random_uuid();
 request_id uuid;
 service_day date := (now() at time zone 'Asia/Bangkok')::date;
 regular_type uuid;
 special_type uuid;
begin
 select id into strict regular_type from public.room_types where code='COMPUTER';
 select id into strict special_type from public.room_types where code='STUDIO';
 insert into public.rooms(id,code,layout_key,name,room_type_id,capacity,visible_on_web) values
  (regular_room,'TEST-HOURS-REGULAR','test-hours-regular','Regular lab',regular_type,10,true),
  (special_room,'TEST-HOURS-SPECIAL','test-hours-special','Special lab',special_type,10,true),
  (hidden_room,'TEST-HOURS-HIDDEN','test-hours-hidden','Hidden lab',regular_type,10,false);

 insert into public.room_category_restrictions(category,policy)
 values ('LAB','{"opensAt":"07:00","closesAt":"17:00"}'), ('SPECIAL','{}')
 on conflict(category) do update set policy=excluded.policy;

 assert exists(select 1 from public.get_public_key_operating_hours()
  where room_id=regular_room and opens_at=time '07:00' and closes_at=time '17:00');
 assert exists(select 1 from public.get_public_key_operating_hours()
  where room_id=special_room and opens_at=time '08:00' and closes_at=time '18:00');
 assert not exists(select 1 from public.get_public_key_operating_hours() where room_id=hidden_room);
 assert has_function_privilege('anon','public.get_public_key_operating_hours()','EXECUTE');
 assert not has_function_privilege('anon','public.key_request_operating_hours(uuid)','EXECUTE');

 insert into public.system_settings(setting_key,setting_value,description)
 values ('ALLOW_PAST_KEY_REQUEST_SLOTS','true','Test any slot on the current Bangkok day'),
        ('OPEN_SATURDAY',to_jsonb(service_day),'Isolated test setting')
 on conflict(setting_key) do update set setting_value=excluded.setting_value;

 request_id := (public.create_key_request(regular_room,'Hours test','hours-test@northbkk.ac.th','OTHER','Hours test',
  (service_day+time '07:00') at time zone 'Asia/Bangkok',
  (service_day+time '17:00') at time zone 'Asia/Bangkok')->>'id')::uuid;
 assert request_id is not null;

 begin
  update public.key_requests set ends_at=(service_day+time '17:30') at time zone 'Asia/Bangkok' where id=request_id;
  raise exception 'Accepted a key request outside configured hours';
 exception when raise_exception or invalid_parameter_value then
  assert sqlerrm='OUTSIDE_OPERATING_HOURS';
 end;
end $$;

rollback;
