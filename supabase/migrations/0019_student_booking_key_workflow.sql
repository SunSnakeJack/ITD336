-- Student-first booking and key workflow for ITD computer laboratories.
update public.room_types set booking_policy = 'MANUAL_APPROVAL' where code = 'COMPUTER';

create or replace function public.prevent_duplicate_pending_lab_booking()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status='PENDING' and exists(
    select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
    where r.id=new.room_id and rt.code='COMPUTER'
  ) and exists(
    select 1 from public.bookings b where b.room_id=new.room_id and b.id is distinct from new.id
      and b.status in ('PENDING','APPROVED','IN_USE')
      and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
  return new;
end $$;

drop trigger if exists reject_duplicate_pending_lab_booking on public.bookings;
create trigger reject_duplicate_pending_lab_booking before insert or update of starts_at,ends_at,status,room_id on public.bookings
for each row execute function public.prevent_duplicate_pending_lab_booking();

create or replace function public.ensure_key_request_for_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'APPROVED' and new.requires_key
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and not exists (
       select 1 from public.key_loans
       where booking_id = new.id and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')
     ) then
    insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,status)
    values(new.id,new.room_id,'BOOKING',coalesce(new.beneficiary_user_id,new.requester_id),new.requester_id,'REQUESTED');
  end if;
  return new;
end $$;

drop trigger if exists create_key_request_after_booking_approval on public.bookings;
create trigger create_key_request_after_booking_approval
after insert or update of status on public.bookings
for each row execute function public.ensure_key_request_for_booking();

create or replace function public.get_room_slot_permissions(
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table(
  can_book boolean,
  can_request_key boolean,
  booking_reason text,
  key_reason text,
  class_schedule_id uuid,
  own_booking_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_start_local timestamp := p_starts_at at time zone 'Asia/Bangkok';
  v_end_local timestamp := p_ends_at at time zone 'Asia/Bangkok';
  v_schedule uuid;
  v_booking public.bookings;
  v_has_other_booking boolean := false;
  v_is_lab boolean := false;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
  if p_ends_at <= p_starts_at then raise exception 'INVALID_TIME_RANGE'; end if;
  select rt.code='COMPUTER' into v_is_lab from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=p_room_id and r.active and r.booking_enabled;
  if v_is_lab is null then raise exception 'ROOM_NOT_AVAILABLE'; end if;

  select s.id into v_schedule
  from public.class_schedules s
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS'
    and s.day_of_week=extract(dow from v_start_local)::smallint
    and v_start_local::date between s.effective_from and s.effective_until
    and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')
      && tsrange(date '2000-01-01'+v_start_local::time,date '2000-01-01'+v_end_local::time,'[)')
  order by s.start_time limit 1;

  select b.* into v_booking from public.bookings b
  where b.room_id=p_room_id and b.requester_id=v_actor
    and b.status in ('PENDING','APPROVED','IN_USE')
    and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
  order by b.created_at desc limit 1;

  select exists(select 1 from public.bookings b where b.room_id=p_room_id and b.requester_id<>v_actor
    and b.status in ('PENDING','APPROVED','IN_USE')
    and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) into v_has_other_booking;

  class_schedule_id := v_schedule;
  own_booking_id := v_booking.id;
  if v_schedule is not null then
    can_book := false; booking_reason := 'ช่วงเวลานี้มีตารางเรียน';
    can_request_key := v_is_lab and (public.has_role('STUDENT') or public.has_role('TEACHER'));
    key_reason := case when not v_is_lab then 'การเบิกกุญแจอัตโนมัติจากคาบเรียนรองรับเฉพาะห้องปฏิบัติการ S2407–S2412'
      when can_request_key then null else 'บทบาทนี้ไม่มีสิทธิ์เบิกกุญแจจากคาบเรียน' end;
  elsif v_booking.id is not null then
    can_book := false; booking_reason := 'คุณมีรายการจองช่วงเวลานี้แล้ว';
    can_request_key := v_booking.status in ('APPROVED','IN_USE') and not exists(
      select 1 from public.key_loans where booking_id=v_booking.id
        and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')
    );
    key_reason := case when v_booking.status='PENDING' then 'รอผู้ดูแลอนุมัติการจองก่อน'
      when can_request_key then null else 'ระบบมีคำขอเบิกกุญแจสำหรับรายการนี้แล้ว' end;
  elsif v_has_other_booking then
    can_book := false; can_request_key := false;
    booking_reason := 'ช่วงเวลานี้มีผู้จองแล้ว'; key_reason := 'ไม่สามารถเบิกกุญแจจากการจองของผู้อื่น';
  else
    can_book := true; can_request_key := false;
    booking_reason := null; key_reason := 'ต้องจองห้องและรออนุมัติก่อนจึงจะเบิกกุญแจได้';
  end if;
  return next;
end $$;

create or replace function public.request_booking_key(p_booking_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;v_loan public.key_loans;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if v_booking.status not in ('APPROVED','IN_USE') then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY'; end if;
  update public.bookings set requires_key=true where id=p_booking_id;
  insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,status,expected_return_at,notes)
  values(p_booking_id,v_booking.room_id,'BOOKING',coalesce(v_booking.beneficiary_user_id,v_booking.requester_id),v_actor,'REQUESTED',v_booking.ends_at,nullif(btrim(p_notes),''))
  returning * into v_loan;
  insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'REQUESTED',v_actor,'Key requested from approved booking');
  perform public.write_audit(v_actor,'KEY_REQUESTED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));
  return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';
end $$;

create or replace function public.request_class_key(
  p_room_id uuid,
  p_class_schedule_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_schedule public.class_schedules;
  v_loan public.key_loans;
  v_start_local timestamp := p_starts_at at time zone 'Asia/Bangkok';
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not (public.has_role('STUDENT') or public.has_role('TEACHER')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select s.* into v_schedule from public.class_schedules s
  join public.rooms r on r.id=s.room_id join public.room_types rt on rt.id=r.room_type_id
  where s.id=p_class_schedule_id and s.room_id=p_room_id and s.active and s.status='ACTIVE'
    and s.schedule_type='CLASS' and rt.code='COMPUTER' for share;
  if not found then raise exception 'VALID_CLASS_SCHEDULE_REQUIRED'; end if;
  if extract(dow from v_start_local)::smallint<>v_schedule.day_of_week
    or v_start_local::date not between v_schedule.effective_from and v_schedule.effective_until
    or v_start_local::time<v_schedule.start_time or (p_ends_at at time zone 'Asia/Bangkok')::time>v_schedule.end_time
  then raise exception 'KEY_USAGE_OUTSIDE_CLASS_PERIOD'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_class_schedule_id::text||v_actor::text,2));
  if exists(select 1 from public.key_loans where class_schedule_id=p_class_schedule_id and borrower_id=v_actor
    and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')
    and expected_return_at=p_ends_at) then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS'; end if;
  insert into public.key_loans(room_id,usage_source,class_schedule_id,borrower_id,requested_by,authorized_by,
    status,approved_at,approved_by,expected_return_at,notes)
  values(p_room_id,'CLASS_SCHEDULE',p_class_schedule_id,v_actor,v_actor,v_actor,'APPROVED',now(),v_actor,p_ends_at,nullif(btrim(p_notes),''))
  returning * into v_loan;
  insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes)
  values(v_loan.id,'APPROVED',v_actor,'Automatically approved from an active class occurrence');
  perform public.write_audit(v_actor,'CLASS_KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan.id,jsonb_build_object('class_schedule_id',p_class_schedule_id));
  return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
end $$;

create or replace function public.report_key_damage(p_key_loan_id uuid,p_description text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans; v_incident uuid;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if nullif(btrim(p_description),'') is null then raise exception 'DAMAGE_DESCRIPTION_REQUIRED'; end if;
  select * into v_loan from public.key_loans where id=p_key_loan_id for update;
  if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
  if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if v_loan.status not in ('CHECKED_OUT','LATE') or v_loan.key_id is null then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
  update public.key_loans set status='DAMAGED',notes=btrim(p_description) where id=p_key_loan_id;
  update public.room_keys set status='DAMAGED' where id=v_loan.key_id;
  insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
  values(v_loan.key_id,p_key_loan_id,v_actor,v_actor,'DAMAGED',btrim(p_description)) returning id into v_incident;
  insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
  values(p_key_loan_id,v_loan.status,'DAMAGED',v_actor,btrim(p_description));
  perform public.write_audit(v_actor,'KEY_DAMAGE_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('incident_id',v_incident));
  return jsonb_build_object('id',p_key_loan_id,'status','DAMAGED','incident_id',v_incident);
end $$;

revoke all on function public.get_room_slot_permissions(uuid,timestamptz,timestamptz),
 public.request_booking_key(uuid,text),public.request_class_key(uuid,uuid,timestamptz,timestamptz,text),public.report_key_damage(uuid,text) from public,anon;
grant execute on function public.get_room_slot_permissions(uuid,timestamptz,timestamptz),
 public.request_booking_key(uuid,text),public.request_class_key(uuid,uuid,timestamptz,timestamptz,text),public.report_key_damage(uuid,text) to authenticated;

do $$ declare v_table text; begin
  foreach v_table in array array['rooms','class_schedules','bookings','key_loans','key_incidents'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
      execute format('alter publication supabase_realtime add table public.%I',v_table);
    end if;
  end loop;
end $$;
