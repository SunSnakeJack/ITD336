-- Preserve the existing requirement until an administrator explicitly turns it off.
create function public.room_requires_rejection_reason(p_room_id uuid)
returns boolean language sql stable set search_path='' as $$
 select public.room_approval_setting(p_room_id,'requireRejectionReason') is distinct from 'false'
$$;
revoke all on function public.room_requires_rejection_reason(uuid) from public,anon,authenticated;

create function public.get_room_rejection_reason_required(p_room_code text)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_APPROVE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 return public.room_requires_rejection_reason((select id from public.rooms where code=p_room_code));
end $$;
revoke all on function public.get_room_rejection_reason_required(text) from public,anon,authenticated;
grant execute on function public.get_room_rejection_reason_required(text) to authenticated;

create or replace function public.save_permission_settings_v2(p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_category text; v_policy jsonb; v_previous jsonb;
begin
 perform public.save_permission_settings(p_changes - 'roomPolicies');
 for v_category,v_policy in select key,value from jsonb_each(coalesce(p_changes->'roomPolicies','{}'::jsonb)) loop
  if v_category not in ('LAB','SPECIAL','MEETING') or jsonb_typeof(v_policy) <> 'object'
     or (v_policy - array['loginForKey','days','opensAt','closesAt','minMinutes','maxMinutes','dailyLimit','advanceDays','approvalMode','approvalDeadline','requireRejectionReason']) <> '{}'::jsonb
     or (v_policy ? 'requireRejectionReason' and jsonb_typeof(v_policy->'requireRejectionReason') <> 'boolean')
     or (v_policy ? 'approvalMode' and coalesce(v_policy->>'approvalMode','') not in ('AUTO','MANUAL'))
     or (v_policy ? 'approvalDeadline' and coalesce(v_policy->>'approvalDeadline','') not in ('START','END'))
     or (v_policy ? 'loginForKey' and jsonb_typeof(v_policy->'loginForKey') <> 'boolean')
     or (v_policy ? 'days' and (jsonb_typeof(v_policy->'days') <> 'array' or exists(
         select 1 from jsonb_array_elements_text(v_policy->'days') as d(day) where day !~ '^[0-6]$')))
     or (v_policy ? 'opensAt' and coalesce(v_policy->>'opensAt','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     or (v_policy ? 'closesAt' and coalesce(v_policy->>'closesAt','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
     or (v_policy->>'opensAt')::time >= (v_policy->>'closesAt')::time
     or (v_policy ? 'minMinutes' and coalesce((v_policy->>'minMinutes')::int,0) not between 1 and 1440)
     or (v_policy ? 'maxMinutes' and coalesce((v_policy->>'maxMinutes')::int,0) not between 1 and 1440)
     or (v_policy->>'minMinutes')::int > (v_policy->>'maxMinutes')::int
     or (v_policy ? 'dailyLimit' and coalesce((v_policy->>'dailyLimit')::int,0) not between 1 and 100)
     or (v_policy ? 'advanceDays' and coalesce((v_policy->>'advanceDays')::int,-1) not between 0 and 30)
  then raise exception 'INVALID_ROOM_POLICY: %',v_category using errcode='22023'; end if;
  select policy into v_previous from public.room_category_restrictions where category=v_category for update;
  if v_previous is not distinct from v_policy then continue; end if;
  insert into public.room_category_restrictions(category,policy) values(v_category,v_policy)
  on conflict(category) do update set policy=excluded.policy;
  perform public.write_audit(auth.uid(),'ROOM_CATEGORY_POLICY_UPDATED','room_category',null,
    jsonb_build_object('name',v_category,'before',v_previous,'after',v_policy));
 end loop;
end $$;

-- Keep the decision metadata constraint for key requests. The RPC enforces the
-- reason policy at rejection time so later policy changes preserve old records.
alter table public.booking_approvals drop constraint booking_approvals_check;
alter table public.key_requests drop constraint key_requests_decision_fields;
alter table public.key_requests add constraint key_requests_decision_fields check (
 status <> 'REJECTED' or (decided_at is not null and decided_by is not null)
);

create or replace function public.reject_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings;
begin
 if not public.has_permission('BOOKING_APPROVE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.status<>'PENDING' then raise exception 'INVALID_BOOKING_TRANSITION'; end if;
 p_reason := nullif(regexp_replace(p_reason,'^[[:space:]]+|[[:space:]]+$','','g'),'');
 if p_reason is null and public.room_requires_rejection_reason(v_booking.room_id) then
  raise exception 'REJECTION_REASON_REQUIRED';
 end if;
 update public.bookings set status='REJECTED' where id=p_booking_id;
 insert into public.booking_approvals(booking_id,action,approver_id,reason) values(p_booking_id,'REJECTED',v_actor,btrim(p_reason));
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,'PENDING','REJECTED',v_actor,btrim(p_reason));
 if v_booking.requester_id is not null then
  perform public.create_notification(v_booking.requester_id,'BOOKING_REJECTED','Booking rejected','Your booking '||v_booking.booking_code||' was rejected'||coalesce(': '||p_reason,'.'),'booking',p_booking_id);
 end if;
 perform public.write_audit(v_actor,'BOOKING_REJECTED','booking',p_booking_id,jsonb_build_object('reason',btrim(p_reason)));
 return jsonb_build_object('id',p_booking_id,'status','REJECTED');
end $$;

create or replace function public.decide_key_request(p_key_request_id uuid,p_decision text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_request public.key_requests;v_next text:=upper(btrim(p_decision));
begin
 if v_actor is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_APPROVE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if v_next not in('APPROVED','REJECTED') then raise exception 'INVALID_DECISION';end if;
 select * into v_request from public.key_requests where id=p_key_request_id for update;
 if not found then raise exception 'KEY_REQUEST_NOT_FOUND';end if;
 if v_request.status<>'PENDING_APPROVAL' then raise exception 'KEY_REQUEST_NOT_PENDING';end if;
 if v_request.ends_at <= pg_catalog.clock_timestamp() and exists (
  select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=v_request.room_id and rt.report_category='SPECIAL_LAB'
 ) then raise exception 'KEY_REQUEST_EXPIRED';end if;
 p_reason := nullif(regexp_replace(p_reason,'^[[:space:]]+|[[:space:]]+$','','g'),'');
 if v_next='REJECTED' and p_reason is null and public.room_requires_rejection_reason(v_request.room_id) then
  raise exception 'REJECTION_REASON_REQUIRED';
 end if;
 update public.key_requests set status=v_next,decided_at=now(),decided_by=v_actor,decision_reason=nullif(btrim(p_reason),'')
 where id=p_key_request_id returning * into v_request;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 values('KEY_REQUEST_'||v_next,v_request.requester_email,'key_request',v_request.id,'key-request-'||lower(v_next),
  jsonb_build_object('request_code',v_request.request_code,'reason',v_request.decision_reason),
  'key-request:'||v_request.id||':decision:'||lower(v_next)) on conflict(idempotency_key) do nothing;
 perform public.write_audit(v_actor,'KEY_REQUEST_'||v_next,'key_request',v_request.id,jsonb_build_object('reason',v_request.decision_reason));
 return jsonb_build_object('id',v_request.id,'status',v_request.status);
end $$;
