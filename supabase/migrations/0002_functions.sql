create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
  join public.permissions p on p.id=rp.permission_id join public.profiles pr on pr.id=ur.user_id
  where ur.user_id=auth.uid() and p.code=p_permission and pr.account_status='ACTIVE'
 )
$$;

create or replace function public.check_room_availability(p_room_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_exclude_booking_id uuid default null)
returns table(available boolean, conflict_type text, conflict_id uuid, conflict_description text)
language plpgsql stable security definer set search_path = '' as $$
begin
 if p_ends_at <= p_starts_at then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 return query
 with conflicts as (
  select 'BOOKING'::text kind,
   case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.id else null::uuid end,
   case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.booking_code else 'Existing booking' end description
  from public.bookings b
   where b.room_id=p_room_id and b.status in ('APPROVED','IN_USE') and b.id is distinct from p_exclude_booking_id
   and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
  union all select 'CLASS_SCHEDULE',c.id,c.course_code||' - '||c.subject_name from public.class_schedules c
   where c.room_id=p_room_id and c.active and tstzrange(c.starts_at,c.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
  union all select 'ROOM_BLOCK',rb.id,rb.reason from public.room_blocks rb
   where rb.room_id=p_room_id and tstzrange(rb.starts_at,rb.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
 )
 select false,kind,id,description from conflicts
 union all select true,null::text,null::uuid,null::text where not exists(select 1 from conflicts);
end $$;

create or replace function public.list_available_rooms(p_starts_at timestamptz,p_ends_at timestamptz)
returns setof public.rooms language sql stable security definer set search_path = '' as $$
 select r.* from public.rooms r where r.active and r.booking_enabled and not exists(
  select 1 from public.check_room_availability(r.id,p_starts_at,p_ends_at) a where not a.available
 ) order by r.name
$$;

create or replace function public.write_audit(p_actor uuid,p_action text,p_entity_type text,p_entity_id uuid,p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(p_actor,p_action,p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb))
$$;
revoke all on function public.write_audit(uuid,text,text,uuid,jsonb) from public, anon, authenticated;

create or replace function public.create_notification(p_user uuid,p_type text,p_title text,p_message text,p_entity_type text,p_entity_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 insert into public.notifications(user_id,type,title,message,related_entity_type,related_entity_id)
 values(p_user,p_type,p_title,p_message,p_entity_type,p_entity_id) returning id into v_id;
 insert into public.notification_deliveries(notification_id,channel) values(v_id,'IN_APP'),(v_id,'EMAIL');
 return v_id;
end $$;
revoke all on function public.create_notification(uuid,text,text,text,text,uuid) from public, anon, authenticated;

create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
begin
 if v_user is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED' using errcode='22023'; end if;
 select * into v_room from public.rooms where id=p_room_id and active for share;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 if not v_room.booking_enabled then raise exception 'ROOM_BOOKING_DISABLED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 insert into public.bookings(requester_id,room_id,starts_at,ends_at,purpose,requires_key,notes)
 values(v_user,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,'PENDING',v_user,'Booking submitted');
 perform public.write_audit(v_user,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id));
 perform public.create_notification(v_user,'BOOKING_SUBMITTED','Booking submitted','Your booking '||v_booking.booking_code||' is pending approval.','booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.approve_booking(p_booking_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings;
begin
 if not public.has_permission('BOOKING_APPROVE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.status<>'PENDING' then raise exception 'INVALID_BOOKING_TRANSITION'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_booking.room_id::text,0));
 if exists(select 1 from public.check_room_availability(v_booking.room_id,v_booking.starts_at,v_booking.ends_at,v_booking.id) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 update public.bookings set status='APPROVED' where id=p_booking_id;
 insert into public.booking_approvals(booking_id,action,approver_id,reason) values(p_booking_id,'APPROVED',v_actor,p_reason);
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,'PENDING','APPROVED',v_actor,p_reason);
 perform public.create_notification(v_booking.requester_id,'BOOKING_APPROVED','Booking approved','Your booking '||v_booking.booking_code||' was approved.','booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_APPROVED','booking',p_booking_id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('id',p_booking_id,'status','APPROVED');
end $$;

create or replace function public.reject_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings;
begin
 if not public.has_permission('BOOKING_APPROVE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.status<>'PENDING' then raise exception 'INVALID_BOOKING_TRANSITION'; end if;
 update public.bookings set status='REJECTED' where id=p_booking_id;
 insert into public.booking_approvals(booking_id,action,approver_id,reason) values(p_booking_id,'REJECTED',v_actor,btrim(p_reason));
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,'PENDING','REJECTED',v_actor,btrim(p_reason));
 perform public.create_notification(v_booking.requester_id,'BOOKING_REJECTED','Booking rejected','Your booking '||v_booking.booking_code||' was rejected: '||btrim(p_reason),'booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_REJECTED','booking',p_booking_id,jsonb_build_object('reason',btrim(p_reason)));
 return jsonb_build_object('id',p_booking_id,'status','REJECTED');
end $$;

create or replace function public.cancel_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.requester_id<>v_actor and not public.has_permission('BOOKING_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_booking.status not in ('PENDING','APPROVED') then raise exception 'INVALID_BOOKING_TRANSITION'; end if;
 update public.bookings set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason=btrim(p_reason) where id=p_booking_id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,v_booking.status,'CANCELLED',v_actor,btrim(p_reason));
 perform public.create_notification(v_booking.requester_id,'BOOKING_CANCELLED','Booking cancelled','Booking '||v_booking.booking_code||' was cancelled.','booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_CANCELLED','booking',p_booking_id,jsonb_build_object('reason',btrim(p_reason)));
 return jsonb_build_object('id',p_booking_id,'status','CANCELLED');
end $$;

create or replace function public.request_key(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings; v_loan public.key_loans;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for share;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.requester_id<>v_actor and not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_booking.status<>'APPROVED' or not v_booking.requires_key then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY'; end if;
 if not exists(select 1 from public.room_keys where room_id=v_booking.room_id and active) then raise exception 'NO_KEYS_CONFIGURED'; end if;
 insert into public.key_loans(booking_id,borrower_id) values(p_booking_id,v_booking.requester_id) returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'REQUESTED',v_actor,'Key requested');
 perform public.write_audit(v_actor,'KEY_REQUESTED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));
 return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';
end $$;

create or replace function public.approve_key_request(p_key_loan_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans;
begin
 if not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
 if v_loan.status<>'REQUESTED' then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
 update public.key_loans set status='APPROVED',approved_at=now(),approved_by=v_actor,notes=coalesce(p_notes,notes) where id=p_key_loan_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,'REQUESTED','APPROVED',v_actor,p_notes);
 perform public.create_notification(v_loan.borrower_id,'KEY_REQUEST_APPROVED','Key request approved','Your key request was approved.','key_loan',p_key_loan_id);
 perform public.write_audit(v_actor,'KEY_REQUEST_APPROVED','key_loan',p_key_loan_id,'{}'::jsonb);
 return jsonb_build_object('id',p_key_loan_id,'status','APPROVED');
end $$;

create or replace function public.checkout_key(p_key_loan_id uuid,p_key_id uuid,p_expected_return_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans; v_key public.room_keys; v_booking public.bookings;
begin
 if not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_expected_return_at<=now() then raise exception 'INVALID_EXPECTED_RETURN'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found or v_loan.status<>'APPROVED' then raise exception 'INVALID_KEY_LOAN'; end if;
 select * into v_booking from public.bookings where id=v_loan.booking_id;
 select * into v_key from public.room_keys where id=p_key_id for update;
 if not found or v_key.status<>'AVAILABLE' or not v_key.active then raise exception 'KEY_NOT_AVAILABLE'; end if;
 if v_key.room_id<>v_booking.room_id then raise exception 'KEY_ROOM_MISMATCH'; end if;
 update public.room_keys set status='CHECKED_OUT' where id=p_key_id;
 update public.key_loans set key_id=p_key_id,status='CHECKED_OUT',checked_out_at=now(),checked_out_by=v_actor,expected_return_at=p_expected_return_at where id=p_key_loan_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,'APPROVED','CHECKED_OUT',v_actor,'Key '||v_key.key_code||' checked out');
 perform public.write_audit(v_actor,'KEY_CHECKED_OUT','key_loan',p_key_loan_id,jsonb_build_object('key_id',p_key_id));
 return jsonb_build_object('id',p_key_loan_id,'status','CHECKED_OUT','key_id',p_key_id);
end $$;

create or replace function public.return_key(p_key_loan_id uuid,p_condition text default 'NORMAL',p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans; v_status public.key_loan_status; v_key_status public.key_status; v_incident public.incident_type;
begin
 if not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if upper(p_condition) not in ('NORMAL','DAMAGED','LOST') then raise exception 'INVALID_KEY_CONDITION'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found or v_loan.status not in ('CHECKED_OUT','LATE') or v_loan.key_id is null then raise exception 'INVALID_KEY_LOAN'; end if;
 perform 1 from public.room_keys where id=v_loan.key_id for update;
 if upper(p_condition)='LOST' then v_status:='LOST'; v_key_status:='LOST'; v_incident:='LOST';
 elsif upper(p_condition)='DAMAGED' then v_status:='DAMAGED'; v_key_status:='DAMAGED'; v_incident:='DAMAGED';
 elsif now()>v_loan.expected_return_at then v_status:='LATE'; v_key_status:='AVAILABLE'; v_incident:='LATE_RETURN';
 else v_status:='RETURNED'; v_key_status:='AVAILABLE'; end if;
 update public.key_loans set status=v_status,returned_at=now(),returned_to=v_actor,notes=coalesce(p_notes,notes) where id=p_key_loan_id;
 update public.room_keys set status=v_key_status where id=v_loan.key_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,v_loan.status,v_status,v_actor,p_notes);
 if v_incident is not null then insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
  values(v_loan.key_id,p_key_loan_id,v_actor,v_loan.borrower_id,v_incident,coalesce(nullif(p_notes,''),v_incident::text||' recorded during return')); end if;
 perform public.create_notification(v_loan.borrower_id,'KEY_RETURNED','Key return recorded','Your key return was recorded as '||v_status::text||'.','key_loan',p_key_loan_id);
 perform public.write_audit(v_actor,case when v_status='LOST' then 'KEY_MARKED_LOST' when v_status='DAMAGED' then 'KEY_MARKED_DAMAGED' else 'KEY_RETURNED' end,'key_loan',p_key_loan_id,jsonb_build_object('condition',p_condition,'status',v_status));
 return jsonb_build_object('id',p_key_loan_id,'status',v_status,'key_status',v_key_status);
end $$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security invoker set search_path = '' as $$
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid()
$$;

revoke all on function public.has_permission(text) from public,anon;
grant execute on function public.has_permission(text) to authenticated;
revoke all on function public.check_room_availability(uuid,timestamptz,timestamptz,uuid), public.list_available_rooms(timestamptz,timestamptz), public.create_booking(uuid,timestamptz,timestamptz,text,boolean,text), public.approve_booking(uuid,text), public.reject_booking(uuid,text), public.cancel_booking(uuid,text), public.request_key(uuid), public.approve_key_request(uuid,text), public.checkout_key(uuid,uuid,timestamptz), public.return_key(uuid,text,text), public.mark_notification_read(uuid) from public,anon;
grant execute on function public.check_room_availability(uuid,timestamptz,timestamptz,uuid), public.list_available_rooms(timestamptz,timestamptz), public.create_booking(uuid,timestamptz,timestamptz,text,boolean,text), public.approve_booking(uuid,text), public.reject_booking(uuid,text), public.cancel_booking(uuid,text), public.request_key(uuid), public.approve_key_request(uuid,text), public.checkout_key(uuid,uuid,timestamptz), public.return_key(uuid,text,text), public.mark_notification_read(uuid) to authenticated;
