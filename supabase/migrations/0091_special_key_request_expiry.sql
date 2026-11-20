-- An unapproved special-room request expires at the end of its requested interval.
create function public.special_key_request_display_status(
 p_status text, p_category text, p_start timestamptz, p_end timestamptz, p_now timestamptz
) returns text language sql immutable set search_path='' as $$
 select case
  when p_status='PENDING_APPROVAL' and p_category='SPECIAL_LAB' and p_now>=p_end then 'EXPIRED'
  when p_status='PENDING_APPROVAL' and p_category='SPECIAL_LAB' and p_now>=p_start then 'PENDING_STARTED'
  else p_status
 end
$$;
revoke all on function public.special_key_request_display_status(text,text,timestamptz,timestamptz,timestamptz) from public,anon,authenticated;

create or replace function public.decide_key_request(p_key_request_id uuid,p_decision text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_request public.key_requests;v_next text:=upper(btrim(p_decision));
begin
 if v_actor is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_APPROVE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if v_next not in('APPROVED','REJECTED') then raise exception 'INVALID_DECISION';end if;
 if v_next='REJECTED' and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED';end if;
 select * into v_request from public.key_requests where id=p_key_request_id for update;
 if not found then raise exception 'KEY_REQUEST_NOT_FOUND';end if;
 if v_request.status<>'PENDING_APPROVAL' then raise exception 'KEY_REQUEST_NOT_PENDING';end if;
 if v_request.ends_at <= pg_catalog.clock_timestamp() and exists (
  select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=v_request.room_id and rt.report_category='SPECIAL_LAB'
 ) then raise exception 'KEY_REQUEST_EXPIRED';end if;
 update public.key_requests set status=v_next,decided_at=now(),decided_by=v_actor,decision_reason=nullif(btrim(p_reason),'')
 where id=p_key_request_id returning * into v_request;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 values('KEY_REQUEST_'||v_next,v_request.requester_email,'key_request',v_request.id,'key-request-'||lower(v_next),
  jsonb_build_object('request_code',v_request.request_code,'reason',v_request.decision_reason),
  'key-request:'||v_request.id||':decision:'||lower(v_next)) on conflict(idempotency_key) do nothing;
 perform public.write_audit(v_actor,'KEY_REQUEST_'||v_next,'key_request',v_request.id,jsonb_build_object('reason',v_request.decision_reason));
 return jsonb_build_object('id',v_request.id,'status',v_request.status);
end $$;

-- Expose staff decision status/reason through controlled read models.

create or replace function public.get_admin_key_request_queue()
returns table(id uuid,request_code text,room_code text,room_name text,requester_name text,requester_email text,purpose text,starts_at timestamptz,ends_at timestamptz,status text,submitted_at timestamptz,decision_reason text)
language plpgsql security definer set search_path='' stable as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_APPROVE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select k.id,k.request_code,r.code,r.name,k.requester_name,k.requester_email,k.purpose,k.starts_at,k.ends_at,public.special_key_request_display_status(k.status,rt.report_category::text,k.starts_at,k.ends_at,now()),k.submitted_at,k.decision_reason
 from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id order by case when k.status='PENDING_APPROVAL' and (rt.report_category<>'SPECIAL_LAB' or k.ends_at>now()) then 0 else 1 end,k.submitted_at desc;
end $$;

create or replace function public.get_my_key_requests_v2()
returns table(id uuid,request_code text,room_code text,room_name text,room_type_name text,floor text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text,decision_reason text,can_cancel boolean,can_return boolean)
language plpgsql security definer set search_path='' stable as $$
declare v_email text;
begin
 select lower(u.email) into v_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if v_email is null then return;end if;
 return query select k.id,k.request_code,r.code,r.name,rt.name,r.floor,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,public.special_key_request_display_status(k.status,rt.report_category::text,k.starts_at,k.ends_at,now()),k.decision_reason,
  (k.status in('PENDING_APPROVAL','APPROVED') and k.ends_at>now()),(k.status in('APPROVED','IN_USE') and now()>=k.starts_at)
 from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id
 where k.authenticated_user_id=auth.uid() or (k.authenticated_user_id is null and lower(k.requester_email)=v_email) order by k.created_at desc;
end $$;

revoke all on function public.get_admin_key_request_queue() from public,anon,authenticated;
revoke all on function public.get_my_key_requests_v2() from public,anon,authenticated;
grant execute on function public.get_admin_key_request_queue() to authenticated;
grant execute on function public.get_my_key_requests_v2() to authenticated;
