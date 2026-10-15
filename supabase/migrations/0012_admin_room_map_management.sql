-- Complete the floor-map room catalog and centralize room availability changes.

insert into public.room_types(code,name,description,booking_policy,student_booking_allowed)
values ('CLASSROOM','Classroom','General teaching classroom','MANUAL_APPROVAL',true)
on conflict(code) do update set name=excluded.name,description=excluded.description;

insert into public.rooms(code,name,room_type_id,building,floor,location_description,capacity,description)
select v.code,'ห้องเรียน '||v.code,rt.id,'อาคารคณะเทคโนโลยีสารสนเทศ','4','ฝั่งห้องเรียน ชั้น 4',40,'ห้องเรียนทั่วไป'
from (values ('2401'),('2402'),('2403'),('2404'),('2405'),('2406')) v(code)
join public.room_types rt on rt.code='CLASSROOM'
where not exists(select 1 from public.rooms r where r.code=v.code);

create or replace function public.set_room_availability(p_room_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_before jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not public.has_permission('ROOM_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select to_jsonb(r) into v_before from public.rooms r where r.id=p_room_id for update;
 if v_before is null then raise exception 'ROOM_NOT_FOUND' using errcode='P0002'; end if;
 update public.rooms set active=p_active,booking_enabled=p_active where id=p_room_id;
 perform public.write_audit(v_actor,'ROOM_AVAILABILITY_CHANGED','room',p_room_id,
  jsonb_build_object('before',v_before,'active',p_active,'booking_enabled',p_active));
 return p_active;
end $$;

revoke all on function public.set_room_availability(uuid,boolean) from public,anon;
grant execute on function public.set_room_availability(uuid,boolean) to authenticated;
