begin;
do $$
declare
 v_today date := (now() at time zone 'Asia/Bangkok')::date;
 v_lab uuid;
 v_special uuid;
begin
 select r.id into strict v_lab from public.get_public_room_catalog() r
 where public.room_policy_category(r.id)='LAB' and r.usage_scope='LABORATORY' limit 1;
 select r.id into strict v_special from public.get_public_room_catalog() r
 where public.room_policy_category(r.id)='SPECIAL' limit 1;
 insert into public.room_category_restrictions(category,policy)
 values ('LAB','{"days":[]}'), ('SPECIAL','{"days":[0,1,2,3,4,5,6]}')
 on conflict (category) do update set policy=excluded.policy;
 if extract(dow from v_today)=6 then
  insert into public.system_settings(setting_key,setting_value)
  values('OPEN_SATURDAY','null') on conflict(setting_key) do update set setting_value=excluded.setting_value;
  assert v_lab=any(public.get_public_rooms_closed_today());
  assert v_special=any(public.get_public_rooms_closed_today());
  update public.system_settings set setting_value=to_jsonb(v_today) where setting_key='OPEN_SATURDAY';
  assert not (v_lab=any(public.get_public_rooms_closed_today()));
 else
  assert v_lab=any(public.get_public_rooms_closed_today());
  assert not (v_special=any(public.get_public_rooms_closed_today()));
 end if;
end $$;
rollback;
