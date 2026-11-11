-- Show the requester role, name, and real purpose for key-request rows in the public room catalog.
create or replace function public.get_public_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text,is_mine boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_can_view boolean;
begin
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 if not exists(select 1 from public.rooms r where r.id=p_room_id and r.active) then raise exception 'ROOM_NOT_FOUND'; end if;
 select case when auth.uid() is null then coalesce(p.guest_view_schedule,true) when public.has_role('STUDENT') then coalesce(p.student_view_schedule,true) else true end into v_can_view from public.rooms r left join public.room_usage_policies p on p.room_id=r.id where r.id=p_room_id;
 if not coalesce(v_can_view,false) then raise exception 'SCHEDULE_POLICY_DENIED' using errcode='42501';end if;
 return query with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'class:'||s.id||':'||s.occurrence_date event_id,'CLASS'::text event_kind,coalesce(s.course_code||' · '||s.subject_name,'ตารางเรียน') event_title,(s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,(s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,null::uuid event_source_id,'CLASS_SCHEDULE'::text event_source_type,'ACTIVE'::text event_status,false event_is_mine from occurrences s
  union all select 'booking:'||md5(b.id::text),'BOOKING','มีการจองห้อง',b.starts_at,b.ends_at,null::uuid,'BOOKING',b.status::text,(auth.uid() is not null and (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid())) from public.bookings b where b.room_id=p_room_id and b.status in ('PENDING','APPROVED','IN_USE') and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'key-request:'||md5(r.id::text),'BOOKING',(case r.requester_type when 'TEACHER' then 'อ. ' when 'STUDENT' then 'นศ. ' else '' end)||r.requester_name||case when nullif(trim(r.purpose),'') is not null then ' · '||trim(r.purpose) else '' end,r.starts_at,r.ends_at,null::uuid,'KEY_REQUEST',r.status,false from public.key_requests r where r.room_id=p_room_id and r.status in('PENDING_APPROVAL','APPROVED','IN_USE') and r.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and r.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE',false from public.room_blocks rb where rb.room_id=p_room_id and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 ) select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status,e.event_is_mine from events e order by e.event_start;
end $$;

revoke all on function public.get_public_room_schedule_events(uuid,date,date) from public;
grant execute on function public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;
