begin;

do $$
declare
 regular_room uuid := gen_random_uuid();
 hidden_room uuid := gen_random_uuid();
 special_room uuid := gen_random_uuid();
 regular_type uuid;
 special_type uuid;
begin
 select id into strict regular_type from public.room_types where code='COMPUTER';
 select id into strict special_type from public.room_types where code='STUDIO';
 insert into public.rooms(id,code,layout_key,name,room_type_id,capacity,visible_on_web) values
  (regular_room,'TEST-KEY-LOGIN','test-key-login','Regular test lab',regular_type,10,true),
  (hidden_room,'TEST-KEY-HIDDEN','test-key-hidden','Hidden test lab',regular_type,10,false),
  (special_room,'TEST-KEY-SPECIAL','test-key-special','Special test lab',special_type,10,true);

 insert into public.room_category_restrictions(category,policy)
 values ('LAB','{"loginForKey":false}'),('SPECIAL','{"loginForKey":false}')
 on conflict(category) do update set policy=excluded.policy;
 assert not (regular_room = any(public.get_public_key_login_required_rooms()));
 assert special_room = any(public.get_public_key_login_required_rooms());

 update public.room_category_restrictions set policy='{"loginForKey":true}' where category='LAB';
 assert regular_room = any(public.get_public_key_login_required_rooms());
 assert not (hidden_room = any(public.get_public_key_login_required_rooms()));
 assert has_function_privilege('anon','public.get_public_key_login_required_rooms()','EXECUTE');
 assert has_function_privilege('authenticated','public.get_public_key_login_required_rooms()','EXECUTE');
 assert not has_table_privilege('anon','public.room_category_restrictions','SELECT');
end $$;

rollback;
