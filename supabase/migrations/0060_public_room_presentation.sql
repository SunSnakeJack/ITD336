-- Public room presentation fields backed by existing room and equipment data.
drop function if exists public.get_public_room_catalog();
create function public.get_public_room_catalog()
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
 where case when auth.uid() is null then coalesce(p.guest_view_details,true)
  when public.has_role('STUDENT') then coalesce(p.student_view_details,true) else true end
 order by r.code
$$;
revoke all on function public.get_public_room_catalog() from public;
grant execute on function public.get_public_room_catalog() to anon,authenticated;
