alter table public.bookings add column approval_deadline_basis text check (approval_deadline_basis in ('START','END'));
alter table public.key_requests add column approval_deadline_basis text check (approval_deadline_basis in ('START','END'));

create function public.room_approval_setting(p_room_id uuid,p_key text)
returns text language sql stable set search_path='' as $$
 select policy->>p_key from public.room_category_restrictions where category=public.room_policy_category(p_room_id)
$$;

create function public.room_approval_display_status(
 p_status text,p_basis text,p_start timestamptz,p_end timestamptz,p_now timestamptz
) returns text language sql immutable set search_path='' as $$
 select case
  when p_status not in ('PENDING','PENDING_APPROVAL') or p_basis is null then p_status
  when p_now >= case when p_basis='START' then p_start else p_end end then 'EXPIRED'
  when p_now >= p_start then 'PENDING_STARTED'
  else p_status
 end
$$;

create function public.enforce_room_approval_deadline()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_pending text := case when tg_table_name='bookings' then 'PENDING' else 'PENDING_APPROVAL' end;
begin
 if tg_op='INSERT' then
  if new.status::text=v_pending then
   new.approval_deadline_basis := coalesce(public.room_approval_setting(new.room_id,'approvalDeadline'),'END');
  end if;
  return new;
 end if;
 if old.status::text=v_pending and new.status::text in ('APPROVED','REJECTED') and
    public.room_approval_display_status(old.status::text,coalesce(old.approval_deadline_basis,'END'),
      old.starts_at,old.ends_at,clock_timestamp())='EXPIRED' then
  raise exception 'ROOM_APPROVAL_EXPIRED';
 end if;
 return new;
end $$;

create trigger enforce_room_booking_approval_deadline before insert or update of status
on public.bookings for each row execute function public.enforce_room_approval_deadline();
create trigger enforce_key_request_approval_deadline before insert or update of status
on public.key_requests for each row execute function public.enforce_room_approval_deadline();

revoke all on function public.room_approval_setting(uuid,text),
 public.room_approval_display_status(text,text,timestamptz,timestamptz,timestamptz),
 public.enforce_room_approval_deadline() from public,anon,authenticated;

create or replace function public.save_permission_settings_v2(p_changes jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_category text; v_policy jsonb; v_previous jsonb;
begin
 perform public.save_permission_settings(p_changes - 'roomPolicies');
 for v_category,v_policy in select key,value from jsonb_each(coalesce(p_changes->'roomPolicies','{}'::jsonb)) loop
  if v_category not in ('LAB','SPECIAL','MEETING') or jsonb_typeof(v_policy) <> 'object'
     or (v_policy - array['loginForKey','days','opensAt','closesAt','minMinutes','maxMinutes','dailyLimit','advanceDays','approvalMode','approvalDeadline']) <> '{}'::jsonb
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

create or replace function public.create_key_request(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_purpose_type text,p_purpose text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_course_code text default null,p_course_name text default null,
 p_lecturer_name text default null,p_lecturer_email text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_type public.room_types;v_request public.key_requests;v_room_mode text;v_profile public.profiles;
 v_today date:=(now() at time zone 'Asia/Bangkok')::date;v_dispatch_token text;
begin
 if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE';end if;
 if (p_starts_at at time zone 'Asia/Bangkok')::date<>v_today or (p_ends_at at time zone 'Asia/Bangkok')::date<>v_today then raise exception 'KEY_REQUEST_CURRENT_DAY_ONLY';end if;
 if (p_starts_at at time zone 'Asia/Bangkok')::time<time '08:00' or (p_ends_at at time zone 'Asia/Bangkok')::time>time '18:00' then raise exception 'OUTSIDE_SERVICE_HOURS';end if;
 select rt.* into v_type from public.rooms r join public.room_types rt on rt.id=r.room_type_id where r.id=p_room_id and r.active and r.booking_enabled for share of r;
 if not found or v_type.usage_scope<>'LABORATORY' then raise exception 'ROOM_NOT_AVAILABLE';end if;
 if v_type.requires_sso_for_key_request and v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select r.key_approval_mode into v_room_mode from public.rooms r where r.id=p_room_id;
 v_room_mode := coalesce(case public.room_approval_setting(p_room_id,'approvalMode') when 'AUTO' then 'AUTO' when 'MANUAL' then 'ADMIN' end, v_room_mode);
 if v_actor is not null then
  select * into v_profile from public.profiles p where p.id=v_actor and p.account_status='ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
  if v_type.requires_sso_for_key_request then p_requester_name:=v_profile.full_name;p_requester_email:=v_profile.email;end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,336));
 if exists(select 1 from public.key_loans l left join public.bookings b on b.id=l.booking_id where l.room_id=p_room_id and l.status in('REQUESTED','APPROVED','CHECKED_OUT','LATE') and tstzrange(coalesce(b.starts_at,l.checked_out_at,l.requested_at),coalesce(b.ends_at,l.expected_return_at,l.requested_at+interval '1 minute'),'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) then raise exception 'LEGACY_KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';end if;
 begin
  insert into public.key_requests(room_id,authenticated_user_id,requester_name,requester_email,purpose_type,purpose,course_code,course_name,lecturer_name,lecturer_email,starts_at,ends_at,status,approval_mode)
  values(p_room_id,v_actor,btrim(p_requester_name),lower(btrim(p_requester_email)),upper(btrim(p_purpose_type)),btrim(p_purpose),nullif(btrim(p_course_code),''),nullif(btrim(p_course_name),''),nullif(btrim(p_lecturer_name),''),lower(nullif(btrim(p_lecturer_email),'')),p_starts_at,p_ends_at,case when coalesce(nullif(v_room_mode,'INHERIT'),v_type.default_key_approval_mode)='AUTO' then 'APPROVED' else 'PENDING_APPROVAL' end,coalesce(nullif(v_room_mode,'INHERIT'),v_type.default_key_approval_mode))
  returning * into v_request;
 exception when exclusion_violation then raise exception 'KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';end;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 values('KEY_REQUEST_SUBMITTED',v_request.requester_email,'key_request',v_request.id,'key-request-submitted',jsonb_build_object('request_code',v_request.request_code,'status',v_request.status,'action_bundle_required',true),'key-request:'||v_request.id||':submitted') on conflict(idempotency_key) do nothing;
 if v_request.purpose_type='TEACHING' and v_request.lecturer_email is not null then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
  values('KEY_REQUEST_LECTURER_NOTICE',v_request.lecturer_email,'key_request',v_request.id,'key-request-lecturer-notice',jsonb_build_object('request_code',v_request.request_code),'key-request:'||v_request.id||':lecturer-submitted') on conflict(idempotency_key) do nothing;
 end if;
 v_dispatch_token:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 insert into public.email_dispatch_tokens(key_request_id,token_digest,expires_at)
 values(v_request.id,extensions.digest(pg_catalog.convert_to(v_dispatch_token,'UTF8'),'sha256'),now()+interval '15 minutes');
 perform public.write_audit(v_actor,'KEY_REQUEST_CREATED','key_request',v_request.id,jsonb_build_object('room_id',p_room_id,'status',v_request.status,'anonymous',v_actor is null));
 return jsonb_build_object('id',v_request.id,'request_code',v_request.request_code,'status',v_request.status,'email_dispatch_token',v_dispatch_token);
end $$;

create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
 v_policy public.booking_policy; v_is_meeting boolean; v_student_allowed boolean; v_status public.booking_status;
 v_displaced uuid; v_override jsonb; v_can_override boolean;
 v_max_days integer; v_open time; v_close time; v_start_local timestamp; v_end_local timestamp; v_today date; v_meeting_dates date[];
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED' using errcode='22023'; end if;
 select r.* into v_room from public.rooms r where r.id=p_room_id and r.active for share;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select rt.booking_policy,rt.student_booking_allowed,rt.usage_scope='MEETING' into v_policy,v_student_allowed,v_is_meeting from public.room_types rt where rt.id=v_room.room_type_id;
 v_can_override := v_is_meeting and public.has_permission('BOOKING_OVERRIDE');
 if not v_is_meeting and not (public.has_role('STUDENT') or public.has_role('TEACHER') or public.has_role('ADMIN')) then
  raise exception 'BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 if not v_room.booking_enabled then raise exception 'ROOM_BOOKING_DISABLED'; end if;
 select (rule_value#>>'{}')::integer into v_max_days from public.booking_rules where rule_key='MAX_ADVANCE_BOOKING_DAYS' and active;
 select (rule_value#>>'{}')::time into v_open from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and active;
 select (rule_value#>>'{}')::time into v_close from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active;
 v_max_days:=coalesce(v_max_days,3); v_open:=coalesce(v_open,'08:30'::time); v_close:=coalesce(v_close,'17:30'::time);
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok'; v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 v_today:=(now() at time zone 'Asia/Bangkok')::date;
 if v_is_meeting then
  if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then
   raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  v_policy := case public.room_approval_setting(p_room_id,'approvalMode') when 'MANUAL' then 'MANUAL_APPROVAL'::public.booking_policy else 'AUTO_CONFIRM'::public.booking_policy end;
  v_can_override := v_can_override and v_policy <> 'MANUAL_APPROVAL';
  select p.allowed_dates,p.opens_at,p.closes_at into v_meeting_dates,v_open,v_close from public.get_meeting_booking_policy() p;
  if not coalesce(v_start_local::date=any(v_meeting_dates), false) then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 elsif v_start_local::date>v_today+v_max_days then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<v_open or v_end_local::time>v_close then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
 if not v_is_meeting and not v_student_allowed and not (public.has_role('TEACHER') or public.has_role('ADMIN')) then
  raise exception 'COLD_ROOM_TEACHER_OR_ADMIN_ONLY' using errcode='42501';
 end if;
 v_status:=case when v_policy='MANUAL_APPROVAL' then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if (v_is_meeting and public.meeting_room_has_pending_overlap(p_room_id,p_starts_at,p_ends_at))
 then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then
  if v_can_override then
   select b.id into v_displaced from public.bookings b
   where b.room_id=p_room_id and b.status='APPROVED' and not b.is_priority and b.starts_at>now()
     and b.starts_at<p_ends_at and b.ends_at>p_starts_at
   order by b.starts_at limit 1;
  end if;
  if v_displaced is null then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
  -- The override RPC rolls back the displacement if another conflict remains.
  v_override := public.create_priority_booking_override(
   v_displaced,p_starts_at,p_ends_at,p_purpose,'Priority meeting booking'
  );
  update public.bookings set notes=p_notes,requires_key=coalesce(p_requires_key,false)
   where id=(v_override->>'priority_booking_id')::uuid returning * into v_booking;
  perform public.create_notification(v_actor,'BOOKING_CONFIRMED','Booking confirmed',
   'Booking '||v_booking.booking_code||' is confirmed.','booking',v_booking.id);
  return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
 end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,requires_key,notes,status,is_priority)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes,v_status,coalesce(v_can_override,false)) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,v_status,v_actor,case when v_status='APPROVED' then 'Automatically confirmed by room policy' else 'Manual approval required by room policy' end);
 perform public.write_audit(v_actor,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id,'policy',v_policy,'status',v_status));
 perform public.create_notification(v_actor,case when v_status='APPROVED' then 'BOOKING_CONFIRMED' else 'BOOKING_SUBMITTED' end,case when v_status='APPROVED' then 'Booking confirmed' else 'Booking submitted' end,'Booking '||v_booking.booking_code||case when v_status='APPROVED' then ' is confirmed.' else ' is pending approval.' end,'booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.get_admin_key_request_queue()
returns table(id uuid,request_code text,room_code text,room_name text,requester_name text,requester_email text,purpose text,starts_at timestamptz,ends_at timestamptz,status text,submitted_at timestamptz,decision_reason text)
language plpgsql security definer set search_path='' stable as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_APPROVE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select k.id,k.request_code,r.code,r.name,k.requester_name,k.requester_email,k.purpose,k.starts_at,k.ends_at,public.room_approval_display_status(k.status,coalesce(k.approval_deadline_basis,case when rt.report_category='SPECIAL_LAB' then 'END' end),k.starts_at,k.ends_at,now()),k.submitted_at,k.decision_reason
 from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id order by case when k.status='PENDING_APPROVAL' and (rt.report_category<>'SPECIAL_LAB' or k.ends_at>now()) then 0 else 1 end,k.submitted_at desc;
end $$;

create or replace function public.get_my_key_requests_v2()
returns table(id uuid,request_code text,room_code text,room_name text,room_type_name text,floor text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text,decision_reason text,can_cancel boolean,can_return boolean)
language plpgsql security definer set search_path='' stable as $$
declare v_email text;
begin
 select lower(u.email) into v_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if v_email is null then return;end if;
 return query select k.id,k.request_code,r.code,r.name,rt.name,r.floor,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,public.room_approval_display_status(k.status,coalesce(k.approval_deadline_basis,case when rt.report_category='SPECIAL_LAB' then 'END' end),k.starts_at,k.ends_at,now()),k.decision_reason,
  (k.status in('PENDING_APPROVAL','APPROVED') and k.ends_at>now()),(k.status in('APPROVED','IN_USE') and now()>=k.starts_at)
 from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id
 where k.authenticated_user_id=auth.uid() or (k.authenticated_user_id is null and lower(k.requester_email)=v_email) order by k.created_at desc;
end $$;

-- Append the deadline field without changing existing view column order or grants.
do $$
declare v_definition text := pg_get_viewdef('public.booking_details_v'::regclass,true);
 v_updated text;
begin
 v_updated := regexp_replace(v_definition, '(\s+FROM (public\.)?bookings b\M)', ', b.approval_deadline_basis\1', 'i');
 if v_updated = v_definition then raise exception 'BOOKING_DETAILS_VIEW_SHAPE_CHANGED'; end if;
 execute 'create or replace view public.booking_details_v with (security_invoker=true) as '||v_updated;
end $$;

create or replace function public.meeting_room_has_pending_overlap(
 p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz
) returns boolean language sql stable set search_path='' as $$
 select exists(
  select 1 from public.bookings b
  where b.room_id=p_room_id and b.status='PENDING'
   and now() < case when b.approval_deadline_basis='START' then b.starts_at else b.ends_at end
   and b.starts_at<p_ends_at and b.ends_at>p_starts_at
 )
$$;

create or replace function public.get_staff_usage_history()
returns table(transaction_id text,source text,room_id uuid,room_code text,room_name text,room_category text,purpose text,user_name text,starts_at timestamptz,ends_at timestamptz,returned_at timestamptz,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not(public.has_permission('REPORT_READ') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query with usage_rows(
  transaction_id,source,room_id,room_code,room_name,room_category,purpose,user_name,starts_at,ends_at,returned_at,status
 ) as (
  select 'booking:'||b.id::text,'BOOKING'::text,r.id,r.code,r.name,'MEETING'::text,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),b.starts_at,b.ends_at,null::timestamptz,public.room_approval_display_status(b.status::text,coalesce(b.approval_deadline_basis,'END'),b.starts_at,b.ends_at,now())
  from public.bookings b join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=b.requester_id where rt.usage_scope='MEETING' and b.status in('PENDING','APPROVED','IN_USE','COMPLETED')
  union all
  select 'key-request:'||k.id::text,'KEY_REQUEST',r.id,r.code,r.name,rt.report_category,case when k.status='REJECTED' then coalesce(k.decision_reason,k.purpose) else k.purpose end,coalesce(nullif(k.requester_name,''),p.full_name,k.requester_email,'ไม่ระบุ'),k.starts_at,k.ends_at,k.returned_at,
   case when k.staff_verified_room_return and k.status='RETURNED' then 'RETURNED_VERIFIED' else public.room_approval_display_status(k.status,coalesce(k.approval_deadline_basis,case when rt.report_category='SPECIAL_LAB' then 'END' end),k.starts_at,k.ends_at,now()) end
  from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=k.authenticated_user_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and k.status in('PENDING_APPROVAL','APPROVED','REJECTED','IN_USE','RETURNED')
  union all
  select 'key-loan:'||kl.id::text,'KEY_LOAN',r.id,r.code,r.name,rt.report_category,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),coalesce(kl.checked_out_at,b.starts_at),b.ends_at,kl.returned_at,
   case when kl.staff_verified_room_return and kl.status='RETURNED' then 'RETURNED_VERIFIED' else kl.status::text end
  from public.key_loans kl join public.bookings b on b.id=kl.booking_id join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=kl.borrower_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and kl.status in('CHECKED_OUT','RETURNED','LATE','LOST','DAMAGED')
 ) select u.* from usage_rows u order by u.starts_at desc,u.transaction_id;
end $$;

create or replace function public.create_priority_booking_override(
 p_displaced_booking_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_reason text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_room_id uuid; v_is_meeting boolean; v_policy record;
 v_start_local timestamp; v_end_local timestamp;
 v_previous_override text := current_setting('app.priority_override',true);
 v_actor uuid:=auth.uid();v_old public.bookings;v_priority public.bookings;v_left uuid;v_right uuid;
begin
 if v_actor is null or not public.has_permission('BOOKING_OVERRIDE') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_ends_at<=p_starts_at or nullif(btrim(p_purpose),'') is null or nullif(btrim(p_reason),'') is null then raise exception 'INVALID_OVERRIDE_INPUT';end if;
 select b.room_id, rt.usage_scope = 'MEETING' into v_room_id,v_is_meeting
 from public.bookings b join public.rooms r on r.id=b.room_id
 join public.room_types rt on rt.id=r.room_type_id where b.id=p_displaced_booking_id;
 if not found then raise exception 'BOOKING_NOT_OVERRIDEABLE'; end if;
 if not v_is_meeting and not (public.has_role('TEACHER') or public.has_role('ADMIN')
  or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if v_is_meeting then
  if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then
   raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  -- Use the same room lock as ordinary creation before locking the displaced row.
  if public.room_approval_setting(v_room_id,'approvalMode')='MANUAL' then raise exception 'ROOM_APPROVAL_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_room_id::text,0));
  select * into v_policy from public.get_meeting_booking_policy();
  v_start_local := p_starts_at at time zone 'Asia/Bangkok';
  v_end_local := p_ends_at at time zone 'Asia/Bangkok';
  if p_starts_at <= now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
  if not coalesce(v_start_local::date = any(v_policy.allowed_dates),false) then
   raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED';
  end if;
  if v_start_local::date <> v_end_local::date or v_start_local::time < v_policy.opens_at
   or v_end_local::time > v_policy.closes_at then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
  if not exists(select 1 from public.rooms where id=v_room_id and active and booking_enabled)
   or public.meeting_room_has_pending_overlap(v_room_id,p_starts_at,p_ends_at) then
   raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';
  end if;
 end if;
 select * into v_old from public.bookings where id=p_displaced_booking_id for update;
 if not found or v_old.status not in('APPROVED','IN_USE') or v_old.is_priority or v_old.room_id is distinct from v_room_id
  or (v_is_meeting and (v_old.status <> 'APPROVED' or v_old.starts_at <= now())) then raise exception 'BOOKING_NOT_OVERRIDEABLE';end if;
 if not tstzrange(v_old.starts_at,v_old.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)') then raise exception 'BOOKINGS_DO_NOT_OVERLAP';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_old.room_id::text,337));
 perform set_config('app.priority_override','true',true);
 update public.bookings set status='SUPERSEDED',override_reason=btrim(p_reason) where id=v_old.id;
 if exists(select 1 from public.check_room_availability(v_old.room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,status,is_priority,origin_booking_id)
 values(v_actor,v_actor,v_actor,v_old.room_id,p_starts_at,p_ends_at,btrim(p_purpose),'APPROVED',true,v_old.id) returning * into v_priority;
 update public.bookings set superseded_by_booking_id=v_priority.id where id=v_old.id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason)
 values(v_old.id,v_old.status,'SUPERSEDED',v_actor,btrim(p_reason));
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason)
 values(v_priority.id,'APPROVED',v_actor,'Priority override');
 update public.booking_segments set segment_status='SUPERSEDED',displaced_by_booking_id=v_priority.id,displacement_reason=btrim(p_reason)
 where booking_id=v_old.id and segment_status='ACTIVE';
 if v_old.starts_at<p_starts_at then
  insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,notes,status,requires_key,origin_booking_id)
  values(v_old.requester_id,v_actor,v_old.beneficiary_user_id,v_old.room_id,v_old.starts_at,least(v_old.ends_at,p_starts_at),v_old.purpose,v_old.notes,'APPROVED',v_old.requires_key,v_old.id) returning id into v_left;
 end if;
 if v_old.ends_at>p_ends_at then
  insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,notes,status,requires_key,origin_booking_id)
  values(v_old.requester_id,v_actor,v_old.beneficiary_user_id,v_old.room_id,greatest(v_old.starts_at,p_ends_at),v_old.ends_at,v_old.purpose,v_old.notes,'APPROVED',v_old.requires_key,v_old.id) returning id into v_right;
 end if;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 select 'BOOKING_PRIORITY_OVERRIDE',p.email,'booking',v_old.id,'booking-priority-override',
  jsonb_build_object('priority_booking_id',v_priority.id,'left_booking_id',v_left,'right_booking_id',v_right,'reason',btrim(p_reason)),
  'booking:'||v_old.id||':priority:'||v_priority.id from public.profiles p where p.id=v_old.requester_id
 on conflict(idempotency_key) do nothing;
 perform public.write_audit(v_actor,'BOOKING_PRIORITY_OVERRIDE','booking',v_old.id,jsonb_build_object('priority_booking_id',v_priority.id,'left_booking_id',v_left,'right_booking_id',v_right));
 perform set_config('app.priority_override',coalesce(v_previous_override,''),true);
 return jsonb_build_object('priority_booking_id',v_priority.id,'left_booking_id',v_left,'right_booking_id',v_right);
end $$;
