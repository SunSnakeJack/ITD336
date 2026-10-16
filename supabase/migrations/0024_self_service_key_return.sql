-- Complete borrower returns immediately and serialize room-level checkout.
insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
select id,'RETURN_REPORTED','RETURNED',return_confirmed_by,'Completed by self-service return migration'
from public.key_loans where status='RETURN_REPORTED';

update public.room_keys k set status='AVAILABLE',updated_at=now()
where exists(select 1 from public.key_loans l where l.key_id=k.id and l.status='RETURN_REPORTED');

update public.key_loans set status='RETURNED',returned_at=coalesce(user_reported_return_at,now()),returned_to=return_confirmed_by
where status='RETURN_REPORTED';

create or replace function public.enforce_single_room_key_holder()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in('CHECKED_OUT','LATE') then
  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text,4));
  if exists(select 1 from public.key_loans l where l.room_id=new.room_id and l.id<>new.id and l.status in('CHECKED_OUT','LATE')) then
   raise exception 'ROOM_KEY_ALREADY_CHECKED_OUT' using errcode='23505';
  end if;
 end if;
 return new;
end $$;

drop trigger if exists enforce_single_room_key_holder on public.key_loans;
create trigger enforce_single_room_key_holder before insert or update of status,room_id on public.key_loans
for each row execute function public.enforce_single_room_key_holder();

create or replace function public.report_key_status(p_key_loan_id uuid,p_action text,p_description text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_loan public.key_loans;v_action text:=upper(btrim(p_action));
 v_next public.key_loan_status;v_incident public.incident_type;v_incident_id uuid;v_now timestamptz:=now();v_key_updated integer;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
 if v_action not in('CHECKED_OUT','RETURNED','LOST','DAMAGED') then raise exception 'INVALID_KEY_ACTION';end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND';end if;
 if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501';end if;

 if v_action='CHECKED_OUT' then
  if v_loan.status<>'APPROVED' then raise exception 'INVALID_KEY_LOAN_TRANSITION';end if;
  perform pg_advisory_xact_lock(hashtextextended(v_loan.room_id::text,4));
  if exists(select 1 from public.key_loans l where l.room_id=v_loan.room_id and l.id<>v_loan.id and l.status in('CHECKED_OUT','LATE')) then raise exception 'ROOM_KEY_ALREADY_CHECKED_OUT' using errcode='23505';end if;
  if v_loan.key_id is not null then
   update public.room_keys set status='CHECKED_OUT',updated_at=v_now where id=v_loan.key_id and active and status in('AVAILABLE','RESERVED');
   get diagnostics v_key_updated=row_count;
   if v_key_updated<>1 then raise exception 'ROOM_KEY_NOT_AVAILABLE';end if;
  end if;
  update public.key_loans set status='CHECKED_OUT',checked_out_at=v_now,checked_out_by=v_actor where id=p_key_loan_id;
  v_next:='CHECKED_OUT';
 elsif v_action='RETURNED' then
  if v_loan.status not in('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION';end if;
  update public.key_loans set status='RETURNED',user_reported_return_at=v_now,return_confirmed_by=v_actor,returned_at=v_now,returned_to=v_actor where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status='AVAILABLE',updated_at=v_now where id=v_loan.key_id;end if;
  v_next:='RETURNED';
 else
  if v_loan.status not in('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION';end if;
  if nullif(btrim(p_description),'') is null then raise exception 'ISSUE_DESCRIPTION_REQUIRED';end if;
  v_next:=v_action::public.key_loan_status;v_incident:=v_action::public.incident_type;
  update public.key_loans set status=v_next,notes=btrim(p_description) where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status=v_action::public.key_status,updated_at=v_now where id=v_loan.key_id;end if;
  insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
  values(v_loan.key_id,p_key_loan_id,v_actor,v_actor,v_incident,btrim(p_description)) returning id into v_incident_id;
 end if;

 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
 values(p_key_loan_id,v_loan.status,v_next,v_actor,coalesce(nullif(btrim(p_description),''),'User completed '||v_action));
 perform public.write_audit(v_actor,'KEY_STATUS_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('action',v_action,'status',v_next,'incident_id',v_incident_id,'self_service',true));
 return jsonb_build_object('id',p_key_loan_id,'status',v_next,'reported_at',v_now,'late',v_action='RETURNED' and v_loan.expected_return_at is not null and v_now>v_loan.expected_return_at);
end $$;

create or replace function public.get_room_slot_permissions(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(can_book boolean,can_request_key boolean,booking_reason text,key_reason text,class_schedule_id uuid,own_booking_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_end_local timestamp:=p_ends_at at time zone 'Asia/Bangkok';v_schedule uuid;v_booking public.bookings;v_other boolean:=false;v_held boolean;v_policy public.room_usage_policies;v_student boolean;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE';end if;
 if not exists(select 1 from public.rooms where id=p_room_id and active and booking_enabled) then raise exception 'ROOM_NOT_AVAILABLE';end if;
 select * into v_policy from public.room_usage_policies where room_id=p_room_id;v_student:=public.has_role('STUDENT');
 select exists(select 1 from public.key_loans l where l.room_id=p_room_id and l.status in('CHECKED_OUT','LATE')) into v_held;
 select s.id into v_schedule from public.class_schedules s where s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' and s.day_of_week=extract(dow from v_start_local)::smallint and v_start_local::date between s.effective_from and s.effective_until and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')&&tsrange(date '2000-01-01'+v_start_local::time,date '2000-01-01'+v_end_local::time,'[)') limit 1;
 select * into v_booking from public.bookings b where b.room_id=p_room_id and (b.requester_id=v_actor or b.beneficiary_user_id=v_actor) and b.status in('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)') order by b.created_at desc limit 1;
 select exists(select 1 from public.bookings b where b.room_id=p_room_id and b.requester_id<>v_actor and b.beneficiary_user_id is distinct from v_actor and b.status in('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) into v_other;
 class_schedule_id:=v_schedule;own_booking_id:=v_booking.id;
 if v_schedule is not null then can_book:=false;booking_reason:='ช่วงเวลานี้มีตารางเรียน';can_request_key:=not v_held and (not v_student or coalesce(v_policy.student_class_key,true));key_reason:=case when v_held then 'ขณะนี้มีผู้ถือกุญแจห้องนี้อยู่' when can_request_key then null else 'ห้องนี้ไม่อนุญาตให้ Student เบิกกุญแจจากคาบเรียน' end;
 elsif v_booking.id is not null then can_book:=false;booking_reason:='คุณมีรายการจองช่วงเวลานี้แล้ว';can_request_key:=not v_held and v_booking.status in('APPROVED','IN_USE') and (not v_student or coalesce(v_policy.student_own_booking_key,true)) and (v_booking.starts_at at time zone 'Asia/Bangkok')::date<=(now() at time zone 'Asia/Bangkok')::date and not exists(select 1 from public.key_loans where booking_id=v_booking.id and status in('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED'));key_reason:=case when v_held then 'ขณะนี้มีผู้ถือกุญแจห้องนี้อยู่' when v_booking.status='PENDING' then 'รอผู้ดูแลอนุมัติการจองก่อน' when (v_booking.starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then 'สามารถเบิกกุญแจได้เมื่อถึงวันที่จอง' when can_request_key then null else 'ไม่มีสิทธิ์หรือมีคำขอเบิกกุญแจแล้ว' end;
 elsif v_other then can_book:=false;can_request_key:=false;booking_reason:='ช่วงเวลานี้มีผู้จองแล้ว';key_reason:='ไม่สามารถเบิกกุญแจจากการจองของผู้อื่น';
 else can_book:=not v_student or coalesce(v_policy.student_book_empty,true);can_request_key:=false;booking_reason:=case when can_book then null else 'ห้องนี้ไม่อนุญาตให้ Student จอง' end;key_reason:=case when v_held then 'ขณะนี้มีผู้ถือกุญแจห้องนี้อยู่' else 'ต้องจองห้องและรออนุมัติก่อน' end;end if;return next;
end $$;

create or replace function public.get_admin_key_cabinet()
returns table(room_id uuid,room_code text,room_name text,room_active boolean,key_status text,available_keys bigint,held_keys bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select r.id,r.code,r.name,r.active,
  case when not r.active then 'ROOM_CLOSED' when exists(select 1 from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE')) then 'CHECKED_OUT' else 'AVAILABLE' end,
  count(k.id) filter(where k.active and k.status='AVAILABLE'),
  (select count(*) from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE'))
 from public.rooms r left join public.room_keys k on k.room_id=r.id group by r.id order by r.code;
end $$;

revoke all on function public.report_key_status(uuid,text,text),public.get_admin_key_cabinet() from public,anon;
grant execute on function public.report_key_status(uuid,text,text),public.get_admin_key_cabinet() to authenticated;
