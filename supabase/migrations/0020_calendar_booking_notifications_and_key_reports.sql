-- Calendar-day booking limit, privacy-safe ownership marker, notifications, and borrower key reports.
create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
 v_policy public.booking_policy; v_student_allowed boolean; v_status public.booking_status;
 v_max_days integer; v_open time; v_close time; v_start_local timestamp; v_end_local timestamp; v_today date;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not (public.has_role('STUDENT') or public.has_role('TEACHER') or public.has_role('ADMIN')) then raise exception 'BOOKING_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED' using errcode='22023'; end if;
 select r.* into v_room from public.rooms r where r.id=p_room_id and r.active for share;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select rt.booking_policy,rt.student_booking_allowed into v_policy,v_student_allowed from public.room_types rt where rt.id=v_room.room_type_id;
 if not v_room.booking_enabled then raise exception 'ROOM_BOOKING_DISABLED'; end if;
 select (rule_value#>>'{}')::integer into v_max_days from public.booking_rules where rule_key='MAX_ADVANCE_BOOKING_DAYS' and active;
 select (rule_value#>>'{}')::time into v_open from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and active;
 select (rule_value#>>'{}')::time into v_close from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active;
 v_max_days:=coalesce(v_max_days,3); v_open:=coalesce(v_open,'08:30'::time); v_close:=coalesce(v_close,'17:30'::time);
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok'; v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 v_today:=(now() at time zone 'Asia/Bangkok')::date;
 if v_start_local::date>v_today+v_max_days then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<v_open or v_end_local::time>v_close then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
 if not v_student_allowed and not (public.has_role('TEACHER') or public.has_role('ADMIN')) then raise exception 'COLD_ROOM_TEACHER_OR_ADMIN_ONLY' using errcode='42501'; end if;
 v_status:=case when v_policy='MANUAL_APPROVAL' then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,requires_key,notes,status)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes,v_status) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,v_status,v_actor,case when v_status='APPROVED' then 'Automatically confirmed by room policy' else 'Manual approval required by room policy' end);
 perform public.write_audit(v_actor,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id,'policy',v_policy,'status',v_status));
 perform public.create_notification(v_actor,case when v_status='APPROVED' then 'BOOKING_CONFIRMED' else 'BOOKING_SUBMITTED' end,case when v_status='APPROVED' then 'Booking confirmed' else 'Booking submitted' end,'Booking '||v_booking.booking_code||case when v_status='APPROVED' then ' is confirmed.' else ' is pending approval.' end,'booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

drop function if exists public.get_public_room_schedule_events(uuid,date,date);
create function public.get_public_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text,is_mine boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 if not exists(select 1 from public.rooms r where r.id=p_room_id and r.active) then raise exception 'ROOM_NOT_FOUND'; end if;
 return query with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'class:'||s.id||':'||s.occurrence_date event_id,'CLASS'::text event_kind,coalesce(s.course_code||' · '||s.subject_name,'ตารางเรียน') event_title,(s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,(s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,null::uuid event_source_id,'CLASS_SCHEDULE'::text event_source_type,'ACTIVE'::text event_status,false event_is_mine from occurrences s
  union all select 'booking:'||md5(b.id::text),'BOOKING','มีการจองห้อง',b.starts_at,b.ends_at,null::uuid,'BOOKING',b.status::text,(auth.uid() is not null and (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid())) from public.bookings b where b.room_id=p_room_id and b.status in ('PENDING','APPROVED','IN_USE') and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE',false from public.room_blocks rb where rb.room_id=p_room_id and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 ) select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status,e.event_is_mine from events e order by e.event_start;
end $$;
revoke all on function public.get_public_room_schedule_events(uuid,date,date) from public;
grant execute on function public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;

create or replace function public.report_key_issue(p_key_loan_id uuid,p_condition text,p_description text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_loan public.key_loans;v_status public.key_loan_status;v_incident public.incident_type;v_incident_id uuid;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if upper(p_condition) not in ('LOST','DAMAGED') then raise exception 'INVALID_KEY_CONDITION'; end if;
 if nullif(btrim(p_description),'') is null then raise exception 'ISSUE_DESCRIPTION_REQUIRED'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
 if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_loan.status not in ('CHECKED_OUT','LATE') or v_loan.key_id is null then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
 v_status:=upper(p_condition)::public.key_loan_status;v_incident:=upper(p_condition)::public.incident_type;
 update public.key_loans set status=v_status,notes=btrim(p_description) where id=p_key_loan_id;
 update public.room_keys set status=upper(p_condition)::public.key_status where id=v_loan.key_id;
 insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description) values(v_loan.key_id,p_key_loan_id,v_actor,v_actor,v_incident,btrim(p_description)) returning id into v_incident_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,v_loan.status,v_status,v_actor,btrim(p_description));
 perform public.write_audit(v_actor,'KEY_ISSUE_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('condition',v_status,'incident_id',v_incident_id));
 return jsonb_build_object('id',p_key_loan_id,'status',v_status,'incident_id',v_incident_id);
end $$;
revoke all on function public.report_key_issue(uuid,text,text) from public,anon;
grant execute on function public.report_key_issue(uuid,text,text) to authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
end $$;
