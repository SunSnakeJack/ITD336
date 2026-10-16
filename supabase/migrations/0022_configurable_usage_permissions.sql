-- Configurable booking/key permissions for S2407-S2412.
insert into public.booking_rules(rule_key,rule_value,description,active)
values('LAB_USAGE_PERMISSION_POLICY','{"student_class_key":true,"teacher_class_key":true,"priority_class_key":true,"student_empty_booking":true,"teacher_empty_booking":true,"priority_empty_booking":true,"manual_approval":true}'::jsonb,'Role and scenario permissions for S2407-S2412',true)
on conflict(rule_key) do nothing;

create or replace function public.get_usage_permission_policy()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_policy jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select rule_value into v_policy from public.booking_rules where rule_key='LAB_USAGE_PERMISSION_POLICY' and active;
 return coalesce(v_policy,'{}'::jsonb);
end $$;

create or replace function public.update_usage_permission_policy(p_policy jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_keys text[]:=array['student_class_key','teacher_class_key','priority_class_key','student_empty_booking','teacher_empty_booking','priority_empty_booking','manual_approval'];v_key text;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 foreach v_key in array v_keys loop
  if not (p_policy?v_key) or jsonb_typeof(p_policy->v_key)<>'boolean' then raise exception 'INVALID_USAGE_POLICY'; end if;
 end loop;
 update public.booking_rules set rule_value=p_policy,description='Role and scenario permissions for S2407-S2412',active=true,updated_by=v_actor,updated_at=now() where rule_key='LAB_USAGE_PERMISSION_POLICY';
 update public.room_types set booking_policy=case when (p_policy->>'manual_approval')::boolean then 'MANUAL_APPROVAL'::public.booking_policy else 'AUTO_CONFIRM'::public.booking_policy end
 where id in(select distinct room_type_id from public.rooms where layout_key~'^S24(0[7-9]|1[0-2])$');
 perform public.write_audit(v_actor,'USAGE_PERMISSION_POLICY_UPDATED','booking_rule',null,p_policy);
 return p_policy;
end $$;

create or replace function public.get_room_slot_permissions(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(can_book boolean,can_request_key boolean,booking_reason text,key_reason text,class_schedule_id uuid,own_booking_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_end_local timestamp:=p_ends_at at time zone 'Asia/Bangkok';
 v_schedule uuid;v_booking public.bookings;v_has_other_booking boolean:=false;v_is_lab boolean:=false;v_policy jsonb;
 v_class_key_allowed boolean:=false;v_empty_booking_allowed boolean:=false;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE'; end if;
 select r.layout_key~'^S24(0[7-9]|1[0-2])$',coalesce(br.rule_value,'{}'::jsonb) into v_is_lab,v_policy
 from public.rooms r left join public.booking_rules br on br.rule_key='LAB_USAGE_PERMISSION_POLICY' and br.active where r.id=p_room_id and r.active and r.booking_enabled;
 if v_is_lab is null then raise exception 'ROOM_NOT_AVAILABLE'; end if;
 v_class_key_allowed:=case when public.has_role('ADMIN') then true when public.has_role('PRIORITY_USER') then coalesce((v_policy->>'priority_class_key')::boolean,true) when public.has_role('TEACHER') then coalesce((v_policy->>'teacher_class_key')::boolean,true) else coalesce((v_policy->>'student_class_key')::boolean,true) end;
 v_empty_booking_allowed:=case when public.has_role('ADMIN') then true when public.has_role('PRIORITY_USER') then coalesce((v_policy->>'priority_empty_booking')::boolean,true) when public.has_role('TEACHER') then coalesce((v_policy->>'teacher_empty_booking')::boolean,true) else coalesce((v_policy->>'student_empty_booking')::boolean,true) end;
 select s.id into v_schedule from public.class_schedules s where s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' and s.day_of_week=extract(dow from v_start_local)::smallint and v_start_local::date between s.effective_from and s.effective_until and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')&&tsrange(date '2000-01-01'+v_start_local::time,date '2000-01-01'+v_end_local::time,'[)') order by s.start_time limit 1;
 select b.* into v_booking from public.bookings b where b.room_id=p_room_id and b.requester_id=v_actor and b.status in ('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)') order by b.created_at desc limit 1;
 select exists(select 1 from public.bookings b where b.room_id=p_room_id and b.requester_id<>v_actor and b.status in ('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) into v_has_other_booking;
 class_schedule_id:=v_schedule;own_booking_id:=v_booking.id;
 if v_schedule is not null then
  can_book:=false;booking_reason:='ช่วงเวลานี้มีตารางเรียน';can_request_key:=v_is_lab and v_class_key_allowed;
  key_reason:=case when not v_is_lab then 'รองรับการเบิกอัตโนมัติเฉพาะ S2407–S2412' when can_request_key then null else 'กฎปัจจุบันไม่อนุญาตให้บทบาทนี้เบิกกุญแจจากคาบเรียน' end;
 elsif v_booking.id is not null then
  can_book:=false;booking_reason:='คุณมีรายการจองช่วงเวลานี้แล้ว';can_request_key:=v_booking.status in ('APPROVED','IN_USE') and not exists(select 1 from public.key_loans where booking_id=v_booking.id and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED'));
  key_reason:=case when v_booking.status='PENDING' then 'รอผู้ดูแลอนุมัติการจองก่อน' when can_request_key then null else 'ระบบมีคำขอเบิกกุญแจสำหรับรายการนี้แล้ว' end;
 elsif v_has_other_booking then can_book:=false;can_request_key:=false;booking_reason:='ช่วงเวลานี้มีผู้จองแล้ว';key_reason:='ไม่สามารถเบิกกุญแจจากการจองของผู้อื่น';
 else can_book:=not v_is_lab or v_empty_booking_allowed;can_request_key:=false;booking_reason:=case when can_book then null else 'กฎปัจจุบันไม่อนุญาตให้บทบาทนี้จองห้อง' end;key_reason:='ต้องจองห้องและรออนุมัติก่อนจึงจะเบิกกุญแจได้';end if;
 return next;
end $$;

create or replace function public.request_class_key(p_room_id uuid,p_class_schedule_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_schedule public.class_schedules;v_loan public.key_loans;v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_policy jsonb;v_allowed boolean;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 select rule_value into v_policy from public.booking_rules where rule_key='LAB_USAGE_PERMISSION_POLICY' and active;
 v_allowed:=case when public.has_role('ADMIN') then true when public.has_role('PRIORITY_USER') then coalesce((v_policy->>'priority_class_key')::boolean,true) when public.has_role('TEACHER') then coalesce((v_policy->>'teacher_class_key')::boolean,true) else public.has_role('STUDENT') and coalesce((v_policy->>'student_class_key')::boolean,true) end;
 if not v_allowed then raise exception 'KEY_POLICY_DENIED' using errcode='42501'; end if;
 select s.* into v_schedule from public.class_schedules s join public.rooms r on r.id=s.room_id where s.id=p_class_schedule_id and s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' and r.layout_key~'^S24(0[7-9]|1[0-2])$' for share;
 if not found then raise exception 'VALID_CLASS_SCHEDULE_REQUIRED'; end if;
 if extract(dow from v_start_local)::smallint<>v_schedule.day_of_week or v_start_local::date not between v_schedule.effective_from and v_schedule.effective_until or v_start_local::time<v_schedule.start_time or (p_ends_at at time zone 'Asia/Bangkok')::time>v_schedule.end_time then raise exception 'KEY_USAGE_OUTSIDE_CLASS_PERIOD'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_class_schedule_id::text||v_actor::text,2));
 if exists(select 1 from public.key_loans where class_schedule_id=p_class_schedule_id and borrower_id=v_actor and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED') and expected_return_at=p_ends_at) then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS'; end if;
 insert into public.key_loans(room_id,usage_source,class_schedule_id,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,expected_return_at,notes) values(p_room_id,'CLASS_SCHEDULE',p_class_schedule_id,v_actor,v_actor,v_actor,'APPROVED',now(),v_actor,p_ends_at,nullif(btrim(p_notes),'')) returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'APPROVED',v_actor,'Automatically approved from configured class permission');
 perform public.write_audit(v_actor,'CLASS_KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan.id,jsonb_build_object('class_schedule_id',p_class_schedule_id));return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
end $$;

create or replace function public.enforce_managed_lab_booking_policy()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_policy jsonb;v_managed boolean;v_allowed boolean;
begin
 select r.layout_key~'^S24(0[7-9]|1[0-2])$',br.rule_value into v_managed,v_policy from public.rooms r left join public.booking_rules br on br.rule_key='LAB_USAGE_PERMISSION_POLICY' and br.active where r.id=new.room_id;
 if not coalesce(v_managed,false) or public.has_role('ADMIN') then return new; end if;
 v_allowed:=case when public.has_role('PRIORITY_USER') then coalesce((v_policy->>'priority_empty_booking')::boolean,true) when public.has_role('TEACHER') then coalesce((v_policy->>'teacher_empty_booking')::boolean,true) else public.has_role('STUDENT') and coalesce((v_policy->>'student_empty_booking')::boolean,true) end;
 if not v_allowed then raise exception 'BOOKING_POLICY_DENIED' using errcode='42501'; end if;
 return new;
end $$;

drop trigger if exists enforce_managed_lab_booking_policy on public.bookings;
create trigger enforce_managed_lab_booking_policy before insert on public.bookings for each row execute function public.enforce_managed_lab_booking_policy();

revoke all on function public.get_usage_permission_policy(),public.update_usage_permission_policy(jsonb) from public,anon;
grant execute on function public.get_usage_permission_policy(),public.update_usage_permission_policy(jsonb) to authenticated;
