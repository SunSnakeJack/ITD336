-- Assign a stable map key independently of the editable room code.
create or replace function public.save_admin_room(
 p_room_id uuid,p_code text,p_name text,p_room_type_id uuid,p_building text,p_floor text,p_location_description text,
 p_capacity integer,p_description text,p_booking_enabled boolean,p_active boolean,p_image_url text,p_computer_type text,p_display_type text,p_equipment jsonb default '[]'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_code text:=btrim(p_code);v_actor uuid:=auth.uid();v_room_id uuid;v_item record;
begin
 if not public.has_permission('ROOM_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if nullif(v_code,'') is null or nullif(btrim(p_name),'') is null or p_capacity<1 then raise exception 'INVALID_ROOM_DETAILS';end if;
 if not exists(select 1 from public.room_types where id=p_room_type_id and active) then raise exception 'INVALID_ROOM_TYPE';end if;
 if jsonb_typeof(coalesce(p_equipment,'[]'::jsonb))<>'array' then raise exception 'INVALID_EQUIPMENT';end if;
 if exists(select 1 from jsonb_to_recordset(coalesce(p_equipment,'[]'::jsonb)) as x("equipmentId" uuid,quantity integer,notes text) where x.quantity<1 or not exists(select 1 from public.equipment e where e.id=x."equipmentId")) then raise exception 'INVALID_EQUIPMENT';end if;
 if p_room_id is null then
  v_room_id := gen_random_uuid();
  insert into public.rooms(id,layout_key,code,name,room_type_id,building,floor,location_description,capacity,description,booking_enabled,active,image_url,computer_type,display_type)
  values(v_room_id,'room-'||v_room_id::text,v_code,btrim(p_name),p_room_type_id,nullif(btrim(p_building),''),nullif(btrim(p_floor),''),nullif(btrim(p_location_description),''),p_capacity,nullif(btrim(p_description),''),p_booking_enabled,p_active,nullif(btrim(p_image_url),''),nullif(btrim(p_computer_type),''),nullif(btrim(p_display_type),'')) returning id into v_room_id;
 else
  update public.rooms set code=v_code,name=btrim(p_name),room_type_id=p_room_type_id,building=nullif(btrim(p_building),''),floor=nullif(btrim(p_floor),''),location_description=nullif(btrim(p_location_description),''),capacity=p_capacity,description=nullif(btrim(p_description),''),booking_enabled=p_booking_enabled,active=p_active,image_url=nullif(btrim(p_image_url),''),computer_type=nullif(btrim(p_computer_type),''),display_type=nullif(btrim(p_display_type),'') where id=p_room_id returning id into v_room_id;
  if v_room_id is null then raise exception 'ROOM_NOT_FOUND';end if;
 end if;
 delete from public.room_equipment where room_id=v_room_id;
 for v_item in select * from jsonb_to_recordset(coalesce(p_equipment,'[]'::jsonb)) as x("equipmentId" uuid,quantity integer,notes text) loop
  insert into public.room_equipment(room_id,equipment_id,quantity,notes) values(v_room_id,v_item."equipmentId",v_item.quantity,nullif(btrim(v_item.notes),''));
 end loop;
 perform public.write_audit(v_actor,case when p_room_id is null then 'ROOM_CREATED' else 'ROOM_UPDATED' end,'room',v_room_id,jsonb_build_object('code',v_code));
 return v_room_id;
exception when unique_violation then raise exception 'ROOM_CODE_ALREADY_EXISTS' using errcode='23505';
end $$;
