-- Requirements V2: trusted booking, override, key-borrowing, and return workflows.
create or replace function public.has_role(p_role text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
  join public.profiles p on p.id=ur.user_id
  where ur.user_id=auth.uid() and r.code=p_role and p.account_status='ACTIVE'
 )
$$;

create or replace function public.check_room_availability(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_exclude_booking_id uuid default null)
returns table(available boolean,conflict_type text,conflict_id uuid,conflict_description text)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 return query
 with conflicts as (
  select 'BOOKING'::text kind,
   case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.id else null::uuid end id,
   case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.booking_code else 'Existing booking' end description
  from public.bookings b where b.room_id=p_room_id and b.status in ('APPROVED','IN_USE')
   and b.id is distinct from p_exclude_booking_id
   and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
  union all
  select case when c.schedule_type='CLASS' then 'CLASS_SCHEDULE' else 'ADMIN_SCHEDULE' end,
   case when public.has_permission('SCHEDULE_READ_ALL') then c.id else null::uuid end,
   case when public.has_permission('SCHEDULE_READ_ALL') then coalesce(c.title,c.course_code||' - '||c.subject_name) else 'Protected schedule' end
  from public.class_schedules c where c.room_id=p_room_id and c.active and c.status='ACTIVE'
   and tstzrange(c.starts_at,c.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
  union all
  select 'ROOM_BLOCK',case when public.has_permission('SCHEDULE_READ_ALL') then rb.id else null::uuid end,
   case when public.has_permission('SCHEDULE_READ_ALL') then rb.reason else 'Room unavailable' end
  from public.room_blocks rb where rb.room_id=p_room_id
   and tstzrange(rb.starts_at,rb.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
 )
 select false,kind,id,description from conflicts
 union all select true,null::text,null::uuid,null::text where not exists(select 1 from conflicts);
end $$;

create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
 v_policy public.booking_policy; v_student_allowed boolean; v_status public.booking_status;
 v_max_days integer; v_open time; v_close time; v_start_local timestamp; v_end_local timestamp;
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
 if p_starts_at>now()+make_interval(days=>v_max_days) then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok'; v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 if v_start_local::date<>v_end_local::date or v_start_local::time<v_open or v_end_local::time>v_close then
  raise exception 'OUTSIDE_OPERATING_HOURS';
 end if;
 if not v_student_allowed and not (public.has_role('TEACHER') or public.has_role('ADMIN')) then
  raise exception 'COLD_ROOM_TEACHER_OR_ADMIN_ONLY' using errcode='42501';
 end if;
 v_status:=case when v_policy='MANUAL_APPROVAL' then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then
  raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';
 end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,requires_key,notes,status)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes,v_status)
 returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason)
 values(v_booking.id,v_status,v_actor,case when v_status='APPROVED' then 'Automatically confirmed by room policy' else 'Manual approval required by room policy' end);
 perform public.write_audit(v_actor,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id,'policy',v_policy,'status',v_status));
 perform public.create_notification(v_actor,case when v_status='APPROVED' then 'BOOKING_CONFIRMED' else 'BOOKING_SUBMITTED' end,
  case when v_status='APPROVED' then 'Booking confirmed' else 'Booking submitted' end,
  'Booking '||v_booking.booking_code||case when v_status='APPROVED' then ' is confirmed.' else ' is pending approval.' end,'booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.create_external_booking(p_external_name text,p_organization_name text,p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_party uuid; v_booking public.bookings; v_room public.rooms;
begin
 if not public.has_permission('BOOKING_CREATE_FOR_OTHERS') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_external_name),'') is null or nullif(btrim(p_reason),'') is null then raise exception 'EXTERNAL_PERSON_AND_REASON_REQUIRED'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE'; end if;
 select * into v_room from public.rooms where id=p_room_id and active and booking_enabled for share;
 if not found then raise exception 'ROOM_NOT_AVAILABLE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE'; end if;
 insert into public.external_parties(full_name,organization_name,created_by) values(btrim(p_external_name),nullif(btrim(p_organization_name),''),v_actor) returning id into v_party;
 insert into public.bookings(requester_id,created_by,external_party_id,room_id,starts_at,ends_at,purpose,status,notes)
 values(v_actor,v_actor,v_party,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),'APPROVED',p_reason) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,'APPROVED',v_actor,'Admin-created external booking: '||btrim(p_reason));
 perform public.write_audit(v_actor,'EXTERNAL_BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('external_party_id',v_party,'reason',btrim(p_reason)));
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status,'external_party_id',v_party);
end $$;

create or replace function public.override_booking(p_existing_booking_id uuid,p_purpose text,p_reason text,p_requires_key boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_old public.bookings; v_new public.bookings;
begin
 if not public.has_permission('BOOKING_OVERRIDE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED'; end if;
 select * into v_old from public.bookings where id=p_existing_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_old.status<>'APPROVED' or v_old.is_priority then raise exception 'ONLY_APPROVED_NON_PRIORITY_BOOKING_CAN_BE_OVERRIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_old.room_id::text,0));
 if exists(select 1 from public.check_room_availability(v_old.room_id,v_old.starts_at,v_old.ends_at,v_old.id) where not available) then
  raise exception 'PROTECTED_OR_ADDITIONAL_CONFLICT_PREVENTS_OVERRIDE';
 end if;
 update public.bookings set status='SUPERSEDED',override_reason=btrim(p_reason) where id=v_old.id;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,status,requires_key,is_priority,notes)
 values(v_actor,v_actor,v_actor,v_old.room_id,v_old.starts_at,v_old.ends_at,btrim(p_purpose),'APPROVED',coalesce(p_requires_key,false),true,'Priority override of '||v_old.booking_code)
 returning * into v_new;
 update public.bookings set superseded_by_booking_id=v_new.id where id=v_old.id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason)
 values(v_old.id,v_old.status,'SUPERSEDED',v_actor,btrim(p_reason)),(v_new.id,null,'APPROVED',v_actor,'Priority booking override');
 perform public.create_notification(v_old.requester_id,'BOOKING_SUPERSEDED','Booking replaced','Booking '||v_old.booking_code||' was replaced by an authorized priority booking.','booking',v_old.id);
 perform public.write_audit(v_actor,'BOOKING_OVERRIDDEN','booking',v_new.id,jsonb_build_object('superseded_booking_id',v_old.id,'reason',btrim(p_reason)));
 return jsonb_build_object('id',v_new.id,'booking_code',v_new.booking_code,'status',v_new.status,'superseded_booking_id',v_old.id);
end $$;

create or replace function public.request_key(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;v_loan public.key_loans;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for share;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor and not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_booking.status<>'APPROVED' or not v_booking.requires_key then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY'; end if;
 if not exists(select 1 from public.room_keys where room_id=v_booking.room_id and active and tracking_mode='TRACKED') then raise exception 'NO_TRACKED_KEYS_CONFIGURED'; end if;
 insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,status)
 values(p_booking_id,v_booking.room_id,'BOOKING',coalesce(v_booking.beneficiary_user_id,v_booking.requester_id),v_actor,'REQUESTED') returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'REQUESTED',v_actor,'Legacy booking key request');
 perform public.write_audit(v_actor,'KEY_REQUESTED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));
 return jsonb_build_object('id',v_loan.id,'status',v_loan.status,'deprecated_workflow',true);
exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';
end $$;

create or replace function public.borrow_key(p_key_id uuid,p_room_id uuid,p_usage_source public.key_usage_source,p_expected_return_at timestamptz,p_booking_id uuid default null,p_class_schedule_id uuid default null,p_borrower_id uuid default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_borrower uuid:=coalesce(p_borrower_id,auth.uid()); v_key public.room_keys; v_booking public.bookings; v_schedule public.class_schedules; v_loan public.key_loans; v_authorizer uuid;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_expected_return_at<=now() then raise exception 'INVALID_EXPECTED_RETURN'; end if;
 if p_usage_source='BOOKING' then
  select * into v_booking from public.bookings where id=p_booking_id and room_id=p_room_id and status in ('APPROVED','IN_USE') for share;
  if not found then raise exception 'VALID_CONFIRMED_BOOKING_REQUIRED'; end if;
  if v_borrower<>v_actor or (v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor and not public.has_permission('KEY_MANAGE')) then raise exception 'FORBIDDEN'; end if;
  if now()<v_booking.starts_at or now()>=v_booking.ends_at or p_expected_return_at>v_booking.ends_at then raise exception 'KEY_USAGE_OUTSIDE_BOOKING_PERIOD'; end if;
  v_authorizer:=v_booking.created_by;
 elsif p_usage_source='CLASS_SCHEDULE' then
  select * into v_schedule from public.class_schedules where id=p_class_schedule_id and room_id=p_room_id and schedule_type='CLASS' and status='ACTIVE' and active for share;
  if not found then raise exception 'VALID_CLASS_SCHEDULE_REQUIRED'; end if;
  if v_schedule.teacher_id<>v_actor and not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if now()<v_schedule.starts_at or p_expected_return_at>v_schedule.ends_at then raise exception 'KEY_USAGE_OUTSIDE_CLASS_PERIOD'; end if;
  v_authorizer:=coalesce(v_schedule.teacher_id,v_actor);
 elsif p_usage_source='DIRECT_USAGE' then
  if not (public.has_permission('KEY_DIRECT_USE') or public.has_permission('KEY_MANAGE')) then raise exception 'FORBIDDEN'; end if;
  if v_borrower<>v_actor and not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN'; end if;
  v_authorizer:=v_actor;
 else raise exception 'INVALID_USAGE_SOURCE'; end if;
 select * into v_key from public.room_keys where id=p_key_id for update;
 if not found or v_key.room_id<>p_room_id or not v_key.active or v_key.tracking_mode<>'TRACKED' or v_key.status<>'AVAILABLE' then raise exception 'KEY_NOT_AVAILABLE'; end if;
 update public.room_keys set status='CHECKED_OUT' where id=p_key_id;
 insert into public.key_loans(booking_id,room_id,usage_source,class_schedule_id,key_id,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,checked_out_at,checked_out_by,expected_return_at,notes)
 values(case when p_usage_source='BOOKING' then p_booking_id end,p_room_id,p_usage_source,case when p_usage_source='CLASS_SCHEDULE' then p_class_schedule_id end,p_key_id,v_borrower,v_actor,v_authorizer,'CHECKED_OUT',now(),v_authorizer,now(),v_actor,p_expected_return_at,p_notes)
 returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'CHECKED_OUT',v_actor,'Borrowed via '||p_usage_source::text);
 perform public.write_audit(v_actor,'KEY_BORROWED','key_loan',v_loan.id,jsonb_build_object('source',p_usage_source,'borrower_id',v_borrower,'key_id',p_key_id));
 return jsonb_build_object('id',v_loan.id,'status',v_loan.status,'key_id',p_key_id,'usage_source',p_usage_source);
exception when unique_violation then raise exception 'KEY_ALREADY_HAS_ACTIVE_LOAN';
end $$;

create or replace function public.confirm_key_return(p_key_loan_id uuid,p_reported_return_at timestamptz default now(),p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if p_reported_return_at>now()+interval '5 minutes' then raise exception 'INVALID_REPORTED_RETURN_TIME'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
 if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_loan.status not in ('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
 if p_reported_return_at<v_loan.checked_out_at then raise exception 'RETURN_BEFORE_CHECKOUT'; end if;
 update public.key_loans set status='RETURN_REPORTED',user_reported_return_at=p_reported_return_at,return_confirmed_by=v_actor,notes=coalesce(p_notes,notes) where id=p_key_loan_id;
 update public.room_keys set status='RESERVED' where id=v_loan.key_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
 values(p_key_loan_id,v_loan.status,'RETURN_REPORTED',v_actor,coalesce(p_notes,'User-reported return; physical handover not independently verified'));
 perform public.write_audit(v_actor,'KEY_RETURN_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('reported_return_at',p_reported_return_at,'physical_verification',false));
 return jsonb_build_object('id',p_key_loan_id,'status','RETURN_REPORTED','physically_verified',false);
end $$;

create or replace function public.return_key(p_key_loan_id uuid,p_condition text default 'NORMAL',p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans; v_status public.key_loan_status; v_key_status public.key_status; v_incident public.incident_type; v_return_time timestamptz;
begin
 if not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if upper(p_condition) not in ('NORMAL','DAMAGED','LOST') then raise exception 'INVALID_KEY_CONDITION'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found or v_loan.status not in ('CHECKED_OUT','LATE','RETURN_REPORTED') or v_loan.key_id is null then raise exception 'INVALID_KEY_LOAN'; end if;
 perform 1 from public.room_keys where id=v_loan.key_id for update;
 v_return_time:=coalesce(v_loan.user_reported_return_at,now());
 if upper(p_condition)='LOST' then v_status:='LOST';v_key_status:='LOST';v_incident:='LOST';
 elsif upper(p_condition)='DAMAGED' then v_status:='DAMAGED';v_key_status:='DAMAGED';v_incident:='DAMAGED';
 elsif v_return_time>v_loan.expected_return_at then v_status:='LATE';v_key_status:='AVAILABLE';v_incident:='LATE_RETURN';
 else v_status:='RETURNED';v_key_status:='AVAILABLE'; end if;
 update public.key_loans set status=v_status,returned_at=v_return_time,returned_to=v_actor,physically_verified_at=now(),physically_verified_by=v_actor,notes=coalesce(p_notes,notes) where id=p_key_loan_id;
 update public.room_keys set status=v_key_status where id=v_loan.key_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,v_loan.status,v_status,v_actor,p_notes);
 if v_incident is not null then insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
 values(v_loan.key_id,p_key_loan_id,v_actor,v_loan.borrower_id,v_incident,coalesce(nullif(p_notes,''),v_incident::text||' recorded during verification')); end if;
 perform public.create_notification(v_loan.borrower_id,'KEY_RETURN_VERIFIED','Key return verified','Your key return was verified as '||v_status::text||'.','key_loan',p_key_loan_id);
 perform public.write_audit(v_actor,'KEY_RETURN_VERIFIED','key_loan',p_key_loan_id,jsonb_build_object('condition',p_condition,'status',v_status));
 return jsonb_build_object('id',p_key_loan_id,'status',v_status,'key_status',v_key_status,'physically_verified',true);
end $$;

revoke all on function public.has_role(text),public.create_external_booking(text,text,uuid,timestamptz,timestamptz,text,text),public.override_booking(uuid,text,text,boolean),public.borrow_key(uuid,uuid,public.key_usage_source,timestamptz,uuid,uuid,uuid,text),public.confirm_key_return(uuid,timestamptz,text) from public,anon;
grant execute on function public.has_role(text),public.create_external_booking(text,text,uuid,timestamptz,timestamptz,text,text),public.override_booking(uuid,text,text,boolean),public.borrow_key(uuid,uuid,public.key_usage_source,timestamptz,uuid,uuid,uuid,text),public.confirm_key_return(uuid,timestamptz,text) to authenticated;
