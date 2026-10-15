-- Admin academic schedule management and a shared, privacy-safe schedule feed.
-- Additive migration: existing schedules and room history remain intact.

alter table public.rooms
 add column academic_schedule_confirmed boolean not null default false,
 add column academic_schedule_confirmed_at timestamptz,
 add column academic_schedule_confirmed_by uuid references public.profiles(id),
 add constraint rooms_schedule_confirmation_check check (
  (not academic_schedule_confirmed and academic_schedule_confirmed_at is null and academic_schedule_confirmed_by is null)
  or (academic_schedule_confirmed and academic_schedule_confirmed_at is not null and academic_schedule_confirmed_by is not null)
 );

alter table public.class_schedules
 add column day_of_week smallint,
 add column start_time time,
 add column end_time time,
 add column updated_at timestamptz not null default now(),
 add column updated_by uuid references public.profiles(id);

update public.class_schedules set
 day_of_week=extract(dow from starts_at at time zone 'Asia/Bangkok')::smallint,
 start_time=(starts_at at time zone 'Asia/Bangkok')::time,
 end_time=(ends_at at time zone 'Asia/Bangkok')::time,
 effective_from=coalesce(effective_from,(starts_at at time zone 'Asia/Bangkok')::date),
 effective_until=coalesce(effective_until,recurrence_until,(starts_at at time zone 'Asia/Bangkok')::date),
 updated_by=created_by;

alter table public.class_schedules
 alter column day_of_week set not null,
 alter column start_time set not null,
 alter column end_time set not null,
 alter column effective_from set not null,
 alter column effective_until set not null,
 add constraint class_schedules_day_check check(day_of_week between 0 and 6),
 add constraint class_schedules_time_check check(end_time>start_time);

create trigger set_class_schedules_updated_at before update on public.class_schedules
for each row execute function public.set_updated_at();

create index class_schedules_recurring_lookup_idx
 on public.class_schedules(room_id,day_of_week,effective_from,effective_until,start_time,end_time)
 where active and status='ACTIVE';

create or replace function public.set_room_schedule_confirmation(p_room_id uuid,p_confirmed boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_before jsonb;
begin
 if not public.has_permission('SCHEDULE_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select to_jsonb(r) into v_before from public.rooms r where r.id=p_room_id for update;
 if v_before is null then raise exception 'ROOM_NOT_FOUND'; end if;
 update public.rooms set academic_schedule_confirmed=p_confirmed,
  academic_schedule_confirmed_at=case when p_confirmed then now() else null end,
  academic_schedule_confirmed_by=case when p_confirmed then v_actor else null end
 where id=p_room_id;
 perform public.write_audit(v_actor,'ROOM_SCHEDULE_CONFIRMATION_CHANGED','room',p_room_id,
  jsonb_build_object('before',v_before,'confirmed',p_confirmed));
end $$;

create or replace function public.upsert_academic_schedule(
 p_schedule_id uuid,p_room_id uuid,p_teacher_id uuid,p_course_code text,p_subject_name text,
 p_academic_year text,p_semester text,p_day_of_week smallint,p_start_time time,p_end_time time,
 p_effective_from date,p_effective_until date
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_id uuid; v_before jsonb; v_first_date date; v_start timestamptz; v_end timestamptz;
begin
 if not public.has_permission('SCHEDULE_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_day_of_week not between 0 and 6 or p_end_time<=p_start_time or p_effective_until<p_effective_from then
  raise exception 'INVALID_SCHEDULE_RANGE' using errcode='22007';
 end if;
 if nullif(btrim(p_course_code),'') is null or nullif(btrim(p_subject_name),'') is null
  or nullif(btrim(p_academic_year),'') is null or nullif(btrim(p_semester),'') is null then
  raise exception 'REQUIRED_SCHEDULE_FIELDS_MISSING' using errcode='22023';
 end if;
 if not exists(select 1 from public.rooms where id=p_room_id and active) then raise exception 'ROOM_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,1));

 if exists(
  select 1 from public.class_schedules s where s.room_id=p_room_id and s.active and s.status='ACTIVE'
   and s.id is distinct from p_schedule_id and s.day_of_week=p_day_of_week
   and daterange(s.effective_from,s.effective_until,'[]')&&daterange(p_effective_from,p_effective_until,'[]')
   and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')
    &&tsrange(date '2000-01-01'+p_start_time,date '2000-01-01'+p_end_time,'[)')
 ) then raise exception 'ACADEMIC_SCHEDULE_CONFLICT' using errcode='23P01'; end if;

 v_first_date:=p_effective_from+((p_day_of_week-extract(dow from p_effective_from)::integer+7)%7);
 if exists(
  select 1 from generate_series(v_first_date,p_effective_until,interval '7 days') occurrence(day)
  join public.bookings b on b.room_id=p_room_id and b.status in ('APPROVED','IN_USE')
   and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(
    (occurrence.day::date+p_start_time) at time zone 'Asia/Bangkok',
    (occurrence.day::date+p_end_time) at time zone 'Asia/Bangkok','[)')
 ) then raise exception 'BOOKING_CONFLICT' using errcode='23P01'; end if;

 if exists(
  select 1 from generate_series(v_first_date,p_effective_until,interval '7 days') occurrence(day)
  join public.room_blocks rb on rb.room_id=p_room_id
   and tstzrange(rb.starts_at,rb.ends_at,'[)')&&tstzrange(
    (occurrence.day::date+p_start_time) at time zone 'Asia/Bangkok',
    (occurrence.day::date+p_end_time) at time zone 'Asia/Bangkok','[)')
 ) then raise exception 'ROOM_BLOCK_CONFLICT' using errcode='23P01'; end if;

 v_start:=(v_first_date+p_start_time) at time zone 'Asia/Bangkok';
 v_end:=(v_first_date+p_end_time) at time zone 'Asia/Bangkok';
 if p_schedule_id is null then
  insert into public.class_schedules(
   room_id,teacher_id,course_code,subject_name,semester,academic_year,starts_at,ends_at,
   recurrence_rule,recurrence_until,active,created_by,schedule_type,status,responsible_user_id,
   effective_from,effective_until,day_of_week,start_time,end_time,updated_by
  ) values(
   p_room_id,p_teacher_id,btrim(p_course_code),btrim(p_subject_name),btrim(p_semester),btrim(p_academic_year),v_start,v_end,
   'FREQ=WEEKLY',p_effective_until,true,v_actor,'CLASS','ACTIVE',p_teacher_id,
   p_effective_from,p_effective_until,p_day_of_week,p_start_time,p_end_time,v_actor
  ) returning id into v_id;
  perform public.write_audit(v_actor,'ACADEMIC_SCHEDULE_CREATED','class_schedule',v_id,
   jsonb_build_object('room_id',p_room_id,'course_code',btrim(p_course_code),'effective_from',p_effective_from,'effective_until',p_effective_until));
 else
  select to_jsonb(s) into v_before from public.class_schedules s where s.id=p_schedule_id for update;
  if v_before is null then raise exception 'SCHEDULE_NOT_FOUND'; end if;
  update public.class_schedules set room_id=p_room_id,teacher_id=p_teacher_id,course_code=btrim(p_course_code),
   subject_name=btrim(p_subject_name),semester=btrim(p_semester),academic_year=btrim(p_academic_year),
   starts_at=v_start,ends_at=v_end,recurrence_rule='FREQ=WEEKLY',recurrence_until=p_effective_until,
   active=true,status='ACTIVE',responsible_user_id=p_teacher_id,effective_from=p_effective_from,
   effective_until=p_effective_until,day_of_week=p_day_of_week,start_time=p_start_time,end_time=p_end_time,updated_by=v_actor
  where id=p_schedule_id returning id into v_id;
  perform public.write_audit(v_actor,'ACADEMIC_SCHEDULE_UPDATED','class_schedule',v_id,
   jsonb_build_object('before',v_before,'room_id',p_room_id,'course_code',btrim(p_course_code)));
 end if;
 return v_id;
end $$;

create or replace function public.deactivate_academic_schedule(p_schedule_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_before jsonb;
begin
 if not public.has_permission('SCHEDULE_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED' using errcode='22023'; end if;
 select to_jsonb(s) into v_before from public.class_schedules s where s.id=p_schedule_id for update;
 if v_before is null then raise exception 'SCHEDULE_NOT_FOUND'; end if;
 update public.class_schedules set active=false,status='CANCELLED',updated_by=v_actor where id=p_schedule_id;
 perform public.write_audit(v_actor,'ACADEMIC_SCHEDULE_DEACTIVATED','class_schedule',p_schedule_id,
  jsonb_build_object('before',v_before,'reason',btrim(p_reason)));
end $$;

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
 )
 select 'schedule:'||s.id||':'||s.occurrence_date,s.schedule_type::text,
  case when s.schedule_type='CLASS' then coalesce(s.course_code||' · '||s.subject_name,s.title,'ชั้นเรียน') else coalesce(s.title,'รายการใช้ห้อง') end,
  (s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok',(s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok',
  s.id,'CLASS_SCHEDULE',s.status::text from occurrences s
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
 order by starts_at;
end $$;

revoke all on function public.set_room_schedule_confirmation(uuid,boolean),
 public.upsert_academic_schedule(uuid,uuid,uuid,text,text,text,text,smallint,time,time,date,date),
 public.deactivate_academic_schedule(uuid,text),public.get_room_schedule_events(uuid,date,date) from public,anon;
grant execute on function public.set_room_schedule_confirmation(uuid,boolean),
 public.upsert_academic_schedule(uuid,uuid,uuid,text,text,text,text,smallint,time,time,date,date),
 public.deactivate_academic_schedule(uuid,text),public.get_room_schedule_events(uuid,date,date) to authenticated;
