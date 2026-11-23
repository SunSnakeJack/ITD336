-- Preserve the existing public catalog at rollout. Visibility is independent of booking policy.
alter table public.rooms add column visible_on_web boolean not null default true;

create or replace function public.get_public_room_catalog()
returns table(
 id uuid,code text,layout_key text,name text,room_type_name text,building text,floor text,
 capacity integer,active boolean,academic_schedule_confirmed boolean,usage_scope text,
 requires_sso_for_key_request boolean,description text,image_url text,equipment jsonb
)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.layout_key,r.code,rt.name,r.building,r.floor,r.capacity,r.active,
  r.academic_schedule_confirmed,rt.usage_scope,rt.requires_sso_for_key_request,r.description,r.image_url,
  coalesce((select jsonb_agg(e.name order by e.name) from public.room_equipment re
   join public.equipment e on e.id=re.equipment_id where re.room_id=r.id),'[]'::jsonb)
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 left join public.room_usage_policies p on p.room_id=r.id
 where r.visible_on_web and case when auth.uid() is null then coalesce(p.guest_view_details,true)
  when public.has_role('STUDENT') then coalesce(p.student_view_details,true) else true end
 order by r.code
$$;
revoke all on function public.get_public_room_catalog() from public;
grant execute on function public.get_public_room_catalog() to anon,authenticated;

create function public.save_admin_room_v2(
 p_room_id uuid,p_code text,p_name text,p_room_type_id uuid,p_building text,p_floor text,
 p_location_description text,p_capacity integer,p_description text,p_visible_on_web boolean,
 p_active boolean,p_image_url text,p_computer_type text,p_display_type text,p_equipment jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_booking_enabled boolean := true; v_room_id uuid;
begin
 if auth.uid() is null or not public.has_permission('ROOM_MANAGE') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_room_id is not null then
  select booking_enabled into v_booking_enabled from public.rooms where id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 end if;
 v_room_id := public.save_admin_room(
  p_room_id,p_code,p_name,p_room_type_id,p_building,p_floor,p_location_description,
  p_capacity,p_description,v_booking_enabled,p_active,p_image_url,p_computer_type,p_display_type,p_equipment
 );
 update public.rooms set visible_on_web=p_visible_on_web where id=v_room_id;
 return v_room_id;
end $$;

create function public.delete_admin_room(p_room_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid(); v_code text; v_name text;
begin
 if v_actor is null or not public.has_permission('ROOM_MANAGE') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 delete from public.rooms where id=p_room_id returning code,name into v_code,v_name;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 perform public.write_audit(v_actor,'ROOM_DELETED','room',p_room_id,jsonb_build_object('code',v_code,'name',v_name));
 return p_room_id;
exception when foreign_key_violation then
 raise exception 'ROOM_HAS_REFERENCES' using errcode='23503';
end $$;

revoke all on function public.save_admin_room_v2(uuid,text,text,uuid,text,text,text,integer,text,boolean,boolean,text,text,text,jsonb),
 public.delete_admin_room(uuid) from public,anon,authenticated;
grant execute on function public.save_admin_room_v2(uuid,text,text,uuid,text,text,text,integer,text,boolean,boolean,text,text,text,jsonb),
 public.delete_admin_room(uuid) to authenticated;

