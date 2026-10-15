-- Privacy-safe read API for guests. Anonymous users receive no direct table access.
create or replace function public.get_public_room_catalog()
returns table(
 id uuid,code text,name text,room_type_name text,building text,floor text,
 capacity integer,academic_schedule_confirmed boolean
)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.name,rt.name,r.building,r.floor,r.capacity,r.academic_schedule_confirmed
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 where r.active
 order by r.code
$$;

create or replace function public.get_public_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 if not exists(select 1 from public.rooms r where r.id=p_room_id and r.active) then raise exception 'ROOM_NOT_FOUND'; end if;
 return query
 with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s
  cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'class:'||s.id||':'||s.occurrence_date event_id,'CLASS'::text event_kind,
   coalesce(s.course_code||' · '||s.subject_name,'ตารางเรียน') event_title,
   (s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,
   (s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,
   null::uuid event_source_id,'CLASS_SCHEDULE'::text event_source_type,'ACTIVE'::text event_status from occurrences s
  union all
  select 'booking:'||md5(b.id::text),'BOOKING','มีการจองห้อง',b.starts_at,b.ends_at,null::uuid,'BOOKING',b.status::text
  from public.bookings b where b.room_id=p_room_id and b.status in ('APPROVED','IN_USE')
   and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all
  select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE'
  from public.room_blocks rb where rb.room_id=p_room_id
   and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 )
 select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status
 from events e order by e.event_start;
end $$;

revoke all on function public.get_public_room_catalog(),public.get_public_room_schedule_events(uuid,date,date) from public;
grant execute on function public.get_public_room_catalog(),public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;
