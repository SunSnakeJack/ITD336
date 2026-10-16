-- Per-room Guest/Student permission matrix and date-safe key checkout.
create table public.room_usage_policies(
 room_id uuid primary key references public.rooms(id) on delete cascade,
 guest_view_details boolean not null default true,guest_view_schedule boolean not null default true,
 student_view_details boolean not null default true,student_view_schedule boolean not null default true,
 student_book_empty boolean not null default true,student_class_key boolean not null default true,
 student_own_booking_key boolean not null default true,student_manage_own_booking boolean not null default true,
 student_view_own_key_status boolean not null default true,student_view_own_history boolean not null default true,
 manual_approval boolean not null default true,updated_by uuid references public.profiles(id),updated_at timestamptz not null default now()
);
insert into public.room_usage_policies(room_id) select id from public.rooms on conflict do nothing;
alter table public.room_usage_policies enable row level security;
create policy "settings managers read room policies" on public.room_usage_policies for select to authenticated using(public.has_permission('SETTINGS_MANAGE'));
revoke all on public.room_usage_policies from anon,authenticated;
grant select on public.room_usage_policies to authenticated;

create or replace function public.get_room_usage_policy(p_room_id uuid)
returns setof public.room_usage_policies language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return query select * from public.room_usage_policies where room_id=p_room_id;
end $$;

create or replace function public.update_room_usage_policy(p_room_id uuid,p_policy jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_before jsonb;v_key text;v_keys text[]:=array['guest_view_details','guest_view_schedule','student_view_details','student_view_schedule','student_book_empty','student_class_key','student_own_booking_key','student_manage_own_booking','student_view_own_key_status','student_view_own_history','manual_approval'];
begin
 if v_actor is null or not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.rooms where id=p_room_id) then raise exception 'ROOM_NOT_FOUND'; end if;
 foreach v_key in array v_keys loop if not(p_policy?v_key) or jsonb_typeof(p_policy->v_key)<>'boolean' then raise exception 'INVALID_ROOM_USAGE_POLICY';end if;end loop;
 select to_jsonb(p) into v_before from public.room_usage_policies p where room_id=p_room_id for update;
 insert into public.room_usage_policies(room_id,guest_view_details,guest_view_schedule,student_view_details,student_view_schedule,student_book_empty,student_class_key,student_own_booking_key,student_manage_own_booking,student_view_own_key_status,student_view_own_history,manual_approval,updated_by,updated_at)
 values(p_room_id,(p_policy->>'guest_view_details')::boolean,(p_policy->>'guest_view_schedule')::boolean,(p_policy->>'student_view_details')::boolean,(p_policy->>'student_view_schedule')::boolean,(p_policy->>'student_book_empty')::boolean,(p_policy->>'student_class_key')::boolean,(p_policy->>'student_own_booking_key')::boolean,(p_policy->>'student_manage_own_booking')::boolean,(p_policy->>'student_view_own_key_status')::boolean,(p_policy->>'student_view_own_history')::boolean,(p_policy->>'manual_approval')::boolean,v_actor,now())
 on conflict(room_id) do update set guest_view_details=excluded.guest_view_details,guest_view_schedule=excluded.guest_view_schedule,student_view_details=excluded.student_view_details,student_view_schedule=excluded.student_view_schedule,student_book_empty=excluded.student_book_empty,student_class_key=excluded.student_class_key,student_own_booking_key=excluded.student_own_booking_key,student_manage_own_booking=excluded.student_manage_own_booking,student_view_own_key_status=excluded.student_view_own_key_status,student_view_own_history=excluded.student_view_own_history,manual_approval=excluded.manual_approval,updated_by=v_actor,updated_at=now();
 perform public.write_audit(v_actor,'ROOM_USAGE_POLICY_UPDATED','room',p_room_id,jsonb_build_object('before',v_before,'after',p_policy));return true;
end $$;

drop function public.get_public_room_catalog();
create function public.get_public_room_catalog()
returns table(id uuid,code text,layout_key text,name text,room_type_name text,building text,floor text,capacity integer,active boolean,academic_schedule_confirmed boolean)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.layout_key,r.name,rt.name,r.building,r.floor,r.capacity,r.active,r.academic_schedule_confirmed
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id left join public.room_usage_policies p on p.room_id=r.id
 where case when auth.uid() is null then coalesce(p.guest_view_details,true) when public.has_role('STUDENT') then coalesce(p.student_view_details,true) else true end order by r.code
$$;
revoke all on function public.get_public_room_catalog() from public;grant execute on function public.get_public_room_catalog() to anon,authenticated;

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
  union all select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE',false from public.room_blocks rb where rb.room_id=p_room_id and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 ) select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status,e.event_is_mine from events e order by e.event_start;
end $$;
revoke all on function public.get_public_room_schedule_events(uuid,date,date) from public;grant execute on function public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;

create or replace function public.get_room_slot_permissions(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(can_book boolean,can_request_key boolean,booking_reason text,key_reason text,class_schedule_id uuid,own_booking_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_end_local timestamp:=p_ends_at at time zone 'Asia/Bangkok';v_schedule uuid;v_booking public.bookings;v_other boolean:=false;v_policy public.room_usage_policies;v_student boolean;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE';end if;
 if not exists(select 1 from public.rooms where id=p_room_id and active and booking_enabled) then raise exception 'ROOM_NOT_AVAILABLE';end if;
 select * into v_policy from public.room_usage_policies where room_id=p_room_id;v_student:=public.has_role('STUDENT');
 select s.id into v_schedule from public.class_schedules s where s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' and s.day_of_week=extract(dow from v_start_local)::smallint and v_start_local::date between s.effective_from and s.effective_until and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')&&tsrange(date '2000-01-01'+v_start_local::time,date '2000-01-01'+v_end_local::time,'[)') limit 1;
 select * into v_booking from public.bookings b where b.room_id=p_room_id and (b.requester_id=v_actor or b.beneficiary_user_id=v_actor) and b.status in('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)') order by b.created_at desc limit 1;
 select exists(select 1 from public.bookings b where b.room_id=p_room_id and b.requester_id<>v_actor and b.beneficiary_user_id is distinct from v_actor and b.status in('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) into v_other;
 class_schedule_id:=v_schedule;own_booking_id:=v_booking.id;
 if v_schedule is not null then can_book:=false;booking_reason:='ช่วงเวลานี้มีตารางเรียน';can_request_key:=not v_student or coalesce(v_policy.student_class_key,true);key_reason:=case when can_request_key then null else 'ห้องนี้ไม่อนุญาตให้ Student เบิกกุญแจจากคาบเรียน' end;
 elsif v_booking.id is not null then can_book:=false;booking_reason:='คุณมีรายการจองช่วงเวลานี้แล้ว';can_request_key:=v_booking.status in('APPROVED','IN_USE') and (not v_student or coalesce(v_policy.student_own_booking_key,true)) and (v_booking.starts_at at time zone 'Asia/Bangkok')::date<=(now() at time zone 'Asia/Bangkok')::date and not exists(select 1 from public.key_loans where booking_id=v_booking.id and status in('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED'));key_reason:=case when v_booking.status='PENDING' then 'รอผู้ดูแลอนุมัติการจองก่อน' when (v_booking.starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then 'สามารถเบิกกุญแจได้เมื่อถึงวันที่จอง' when can_request_key then null else 'ไม่มีสิทธิ์หรือมีคำขอเบิกกุญแจแล้ว' end;
 elsif v_other then can_book:=false;can_request_key:=false;booking_reason:='ช่วงเวลานี้มีผู้จองแล้ว';key_reason:='ไม่สามารถเบิกกุญแจจากการจองของผู้อื่น';
 else can_book:=not v_student or coalesce(v_policy.student_book_empty,true);can_request_key:=false;booking_reason:=case when can_book then null else 'ห้องนี้ไม่อนุญาตให้ Student จอง' end;key_reason:='ต้องจองห้องและรออนุมัติก่อน';end if;return next;
end $$;

create or replace function public.request_class_key(p_room_id uuid,p_class_schedule_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_schedule public.class_schedules;v_loan public.key_loans;v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_allowed boolean;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
 select coalesce(p.student_class_key,true) into v_allowed from public.rooms r left join public.room_usage_policies p on p.room_id=r.id where r.id=p_room_id and r.active;
 if not found then raise exception 'ROOM_NOT_AVAILABLE';end if;
 if public.has_role('STUDENT') and not v_allowed then raise exception 'KEY_POLICY_DENIED' using errcode='42501';end if;
 select s.* into v_schedule from public.class_schedules s where s.id=p_class_schedule_id and s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' for share;
 if not found then raise exception 'VALID_CLASS_SCHEDULE_REQUIRED';end if;
 if extract(dow from v_start_local)::smallint<>v_schedule.day_of_week or v_start_local::date not between v_schedule.effective_from and v_schedule.effective_until or v_start_local::time<v_schedule.start_time or (p_ends_at at time zone 'Asia/Bangkok')::time>v_schedule.end_time then raise exception 'KEY_USAGE_OUTSIDE_CLASS_PERIOD';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_class_schedule_id::text||v_actor::text,2));
 if exists(select 1 from public.key_loans where class_schedule_id=p_class_schedule_id and borrower_id=v_actor and status in('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED') and expected_return_at=p_ends_at) then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';end if;
 insert into public.key_loans(room_id,usage_source,class_schedule_id,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,expected_return_at,notes) values(p_room_id,'CLASS_SCHEDULE',p_class_schedule_id,v_actor,v_actor,v_actor,'APPROVED',now(),v_actor,p_ends_at,nullif(btrim(p_notes),'')) returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'APPROVED',v_actor,'Automatically approved from room class-key permission');
 perform public.write_audit(v_actor,'CLASS_KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan.id,jsonb_build_object('class_schedule_id',p_class_schedule_id));return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
end $$;

create or replace function public.enforce_managed_lab_booking_policy()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_policy public.room_usage_policies;
begin select * into v_policy from public.room_usage_policies where room_id=new.room_id;if public.has_role('STUDENT') and not coalesce(v_policy.student_book_empty,true) then raise exception 'BOOKING_POLICY_DENIED' using errcode='42501';end if;if public.has_role('STUDENT') then new.status:=case when coalesce(v_policy.manual_approval,true) then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;end if;return new;end $$;

create or replace function public.request_booking_key(p_booking_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;v_loan public.key_loans;v_policy public.room_usage_policies;
begin if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;select * into v_booking from public.bookings where id=p_booking_id for update;if not found then raise exception 'BOOKING_NOT_FOUND';end if;if v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor then raise exception 'FORBIDDEN' using errcode='42501';end if;if v_booking.status not in('APPROVED','IN_USE') then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY';end if;if (v_booking.starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then raise exception 'KEY_NOT_AVAILABLE_BEFORE_BOOKING_DATE';end if;select * into v_policy from public.room_usage_policies where room_id=v_booking.room_id;if public.has_role('STUDENT') and not coalesce(v_policy.student_own_booking_key,true) then raise exception 'KEY_POLICY_DENIED' using errcode='42501';end if;
 update public.bookings set requires_key=true where id=p_booking_id;insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,status,expected_return_at,notes) values(p_booking_id,v_booking.room_id,'BOOKING',coalesce(v_booking.beneficiary_user_id,v_booking.requester_id),v_actor,'REQUESTED',v_booking.ends_at,nullif(btrim(p_notes),'')) returning * into v_loan;insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'REQUESTED',v_actor,'Key requested from approved booking');perform public.write_audit(v_actor,'KEY_REQUESTED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));return jsonb_build_object('id',v_loan.id,'status',v_loan.status);exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';end $$;

drop view public.key_loan_report_v;
create view public.key_loan_report_v with(security_invoker=true) as select l.id,l.room_id,r.code room_code,l.key_id,k.key_code,l.borrower_id,l.usage_source,l.status,l.checked_out_at,l.expected_return_at,l.user_reported_return_at,l.returned_at,b.starts_at available_from,(l.expected_return_at is not null and coalesce(l.user_reported_return_at,l.returned_at,now())>l.expected_return_at and l.status in('CHECKED_OUT','LATE','RETURN_REPORTED')) overdue from public.key_loans l join public.rooms r on r.id=l.room_id left join public.room_keys k on k.id=l.key_id left join public.bookings b on b.id=l.booking_id;
grant select on public.key_loan_report_v to authenticated;

create or replace function public.enforce_key_checkout_date()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_starts_at timestamptz;
begin if new.status='CHECKED_OUT' and old.status='APPROVED' and new.booking_id is not null then select starts_at into v_starts_at from public.bookings where id=new.booking_id;if (v_starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then raise exception 'KEY_NOT_AVAILABLE_BEFORE_BOOKING_DATE';end if;end if;return new;end $$;
drop trigger if exists enforce_key_checkout_date on public.key_loans;
create trigger enforce_key_checkout_date before update of status on public.key_loans for each row execute function public.enforce_key_checkout_date();

create or replace function public.enforce_student_booking_management_policy()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_allowed boolean;
begin if new.status='CANCELLED' and old.status is distinct from new.status and old.requester_id=auth.uid() and public.has_role('STUDENT') then select student_manage_own_booking into v_allowed from public.room_usage_policies where room_id=old.room_id;if not coalesce(v_allowed,true) then raise exception 'BOOKING_MANAGEMENT_POLICY_DENIED' using errcode='42501';end if;end if;return new;end $$;
drop trigger if exists enforce_student_booking_management_policy on public.bookings;
create trigger enforce_student_booking_management_policy before update of status on public.bookings for each row execute function public.enforce_student_booking_management_policy();

create or replace function public.get_admin_key_cabinet()
returns table(room_id uuid,room_code text,room_name text,room_active boolean,key_status text,available_keys bigint,held_keys bigint)
language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;return query select r.id,r.code,r.name,r.active,case when not r.active then 'ROOM_CLOSED' when exists(select 1 from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE','RETURN_REPORTED')) then 'CHECKED_OUT' else 'AVAILABLE' end,count(k.id) filter(where k.active and k.status='AVAILABLE'),(select count(*) from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE','RETURN_REPORTED')) from public.rooms r left join public.room_keys k on k.room_id=r.id group by r.id order by r.code;end $$;

revoke all on function public.get_room_usage_policy(uuid),public.update_room_usage_policy(uuid,jsonb),public.get_admin_key_cabinet() from public,anon;
grant execute on function public.get_room_usage_policy(uuid),public.update_room_usage_policy(uuid,jsonb),public.get_admin_key_cabinet() to authenticated;
