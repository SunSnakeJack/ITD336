-- Keep floor-plan placement stable while allowing the user-facing room code to change.
alter table public.rooms add column layout_key text;
update public.rooms set layout_key = code where layout_key is null;
alter table public.rooms alter column layout_key set not null;
alter table public.rooms add constraint rooms_layout_key_key unique(layout_key);

drop function public.get_public_room_catalog();
create function public.get_public_room_catalog()
returns table(
 id uuid,code text,layout_key text,name text,room_type_name text,building text,floor text,
 capacity integer,active boolean,academic_schedule_confirmed boolean
)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.layout_key,r.name,rt.name,r.building,r.floor,r.capacity,r.active,r.academic_schedule_confirmed
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 order by r.code
$$;

revoke all on function public.get_public_room_catalog() from public;
grant execute on function public.get_public_room_catalog() to anon,authenticated;

create or replace function public.update_room_details_v2(
  p_room_id uuid,
  p_code text,
  p_name text,
  p_capacity integer,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(p_code));
  v_before jsonb;
begin
  if v_actor is null or not public.has_permission('ROOM_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(v_code, '') is null or v_code !~ '^[A-Z0-9_-]+$' then
    raise exception 'INVALID_ROOM_CODE';
  end if;
  if exists(select 1 from public.rooms where code = v_code and id <> p_room_id) then
    raise exception 'ROOM_CODE_ALREADY_EXISTS' using errcode = '23505';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'ROOM_NAME_REQUIRED';
  end if;
  if p_capacity < 1 or p_capacity > 1000 then
    raise exception 'INVALID_ROOM_CAPACITY';
  end if;

  select to_jsonb(r) into v_before from public.rooms r where r.id = p_room_id for update;
  if v_before is null then raise exception 'ROOM_NOT_FOUND'; end if;

  update public.rooms
  set code = v_code,
      name = btrim(p_name),
      capacity = p_capacity,
      active = p_active,
      booking_enabled = p_active
  where id = p_room_id;

  perform public.write_audit(
    v_actor,'ROOM_DETAILS_UPDATED','room',p_room_id,
    jsonb_build_object('before',v_before,'code',v_code,'name',btrim(p_name),'capacity',p_capacity,'active',p_active,'booking_enabled',p_active)
  );
  return true;
end
$$;

revoke all on function public.update_room_details_v2(uuid,text,text,integer,boolean) from public,anon;
grant execute on function public.update_room_details_v2(uuid,text,text,integer,boolean) to authenticated;
