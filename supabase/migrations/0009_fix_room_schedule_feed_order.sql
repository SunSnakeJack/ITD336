-- Keep applied migration history immutable. Replace only the faulty feed function.
create or replace function public.get_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 return query
 with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s
  cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where (p_room_id is null or s.room_id=p_room_id) and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'schedule:'||s.id||':'||s.occurrence_date event_id,s.schedule_type::text event_kind,
   case when s.schedule_type='CLASS' then coalesce(s.course_code||' · '||s.subject_name,s.title,'ชั้นเรียน') else coalesce(s.title,'รายการใช้ห้อง') end event_title,
   (s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,
   (s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,
   s.id event_source_id,'CLASS_SCHEDULE'::text event_source_type,s.status::text event_status from occurrences s
  union all
  select 'booking:'||b.id,'BOOKING',case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.purpose else 'มีการจองห้อง' end,
   b.starts_at,b.ends_at,b.id,'BOOKING',b.status::text from public.bookings b
  where (p_room_id is null or b.room_id=p_room_id) and b.status in ('APPROVED','IN_USE')
   and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all
  select 'block:'||rb.id,case when rb.reason ilike '%maintenance%' or rb.reason ilike '%ซ่อม%' then 'MAINTENANCE' else 'BLOCKED' end,
   case when public.has_permission('SCHEDULE_READ_ALL') then rb.reason else 'ห้องไม่พร้อมใช้งาน' end,
   rb.starts_at,rb.ends_at,rb.id,'ROOM_BLOCK','ACTIVE' from public.room_blocks rb
  where (p_room_id is null or rb.room_id=p_room_id) and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok')
   and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 )
 select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status
 from events e order by e.event_start;
end $$;

revoke all on function public.get_room_schedule_events(uuid,date,date) from public,anon;
grant execute on function public.get_room_schedule_events(uuid,date,date) to authenticated;
