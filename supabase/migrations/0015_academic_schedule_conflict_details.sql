-- Provide authorized, non-sensitive conflict detail for the Admin schedule form.

create or replace function public.find_academic_schedule_conflict(
 p_schedule_id uuid,p_room_id uuid,p_day_of_week smallint,p_start_time time,p_end_time time,
 p_effective_from date,p_effective_until date
) returns table(day_of_week smallint,course_code text,subject_name text,start_time time,end_time time)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not public.has_permission('SCHEDULE_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_day_of_week not between 0 and 6 or p_end_time<=p_start_time or p_effective_until<p_effective_from then
  raise exception 'INVALID_SCHEDULE_RANGE' using errcode='22007';
 end if;
 return query
 select s.day_of_week,s.course_code,s.subject_name,s.start_time,s.end_time
 from public.class_schedules s
 where s.room_id=p_room_id and s.active and s.status='ACTIVE'
  and s.id is distinct from p_schedule_id and s.day_of_week=p_day_of_week
  and daterange(s.effective_from,s.effective_until,'[]')&&daterange(p_effective_from,p_effective_until,'[]')
  and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')
   &&tsrange(date '2000-01-01'+p_start_time,date '2000-01-01'+p_end_time,'[)')
 order by s.start_time,s.course_code
 limit 1;
end $$;

revoke all on function public.find_academic_schedule_conflict(uuid,uuid,smallint,time,time,date,date) from public,anon;
grant execute on function public.find_academic_schedule_conflict(uuid,uuid,smallint,time,time,date,date) to authenticated;
