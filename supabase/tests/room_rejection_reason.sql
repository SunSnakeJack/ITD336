begin;
do $$
declare
 v_room uuid;
 v_category text;
begin
 assert not has_function_privilege('anon','public.get_room_rejection_reason_required(text)','execute');
 assert not has_function_privilege('authenticated','public.room_requires_rejection_reason(uuid)','execute');

 for v_category in select unnest(array['LAB','SPECIAL','MEETING']) loop
  select id into strict v_room from public.rooms
  where public.room_policy_category(id)=v_category limit 1;
  insert into public.room_category_restrictions(category,policy) values(v_category,'{}')
  on conflict(category) do update set policy=excluded.policy;
  assert public.room_requires_rejection_reason(v_room);
  update public.room_category_restrictions set policy='{"requireRejectionReason":false}' where category=v_category;
  assert not public.room_requires_rejection_reason(v_room);
  update public.room_category_restrictions set policy='{"requireRejectionReason":true}' where category=v_category;
  assert public.room_requires_rejection_reason(v_room);
 end loop;
end $$;
rollback;
