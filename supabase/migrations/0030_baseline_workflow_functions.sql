-- Transactional workflow RPCs for the approved FR/NFR baseline.

create or replace function public.append_key_request_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.key_request_status_history(key_request_id,new_status,actor_user_id,actor_kind,reason)
  values(new.id,new.status,new.authenticated_user_id,case when new.authenticated_user_id is null then 'ANONYMOUS' else 'USER' end,'Request submitted');
 elsif new.status is distinct from old.status then
  insert into public.key_request_status_history(key_request_id,previous_status,new_status,actor_user_id,actor_kind,reason)
  values(new.id,old.status,new.status,coalesce(new.decided_by,new.authenticated_user_id),
   coalesce(nullif(current_setting('app.key_request_actor_kind',true),''),
    case when new.decided_by is not null then 'ADMIN' when new.authenticated_user_id is not null then 'USER' else 'SYSTEM' end),
   coalesce(new.decision_reason,'Status changed'));
 end if;
 return new;
end $$;

create or replace function public.update_room_key_approval_mode(p_room_id uuid,p_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_mode text:=upper(btrim(p_mode));v_before text;
begin
 if v_actor is null or not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if v_mode not in('INHERIT','AUTO','ADMIN') then raise exception 'INVALID_APPROVAL_MODE';end if;
 select key_approval_mode into v_before from public.rooms where id=p_room_id for update;
 if not found then raise exception 'ROOM_NOT_FOUND';end if;
 update public.rooms set key_approval_mode=v_mode where id=p_room_id;
 perform public.write_audit(v_actor,'ROOM_KEY_APPROVAL_MODE_CHANGED','room',p_room_id,jsonb_build_object('before',v_before,'after',v_mode));
end $$;

create or replace function public.create_meeting_booking(
 p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_booking public.bookings;v_today date:=(now() at time zone 'Asia/Bangkok')::date;
 v_allowed_until date:=v_today;v_days integer:=0;v_limit integer:=3;v_start_local timestamp;v_end_local timestamp;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
 if nullif(btrim(p_purpose),'') is null or p_ends_at<=p_starts_at then raise exception 'INVALID_BOOKING_INPUT';end if;
 if not exists(select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=p_room_id and r.active and r.booking_enabled and rt.usage_scope='MEETING') then raise exception 'MEETING_ROOM_NOT_AVAILABLE';end if;
 select coalesce((rule_value#>>'{}')::integer,3) into v_limit from public.booking_rules
 where rule_key='MEETING_ADVANCE_BOOKING_DAYS' and active;
 v_limit:=coalesce(v_limit,3);
 while v_days<v_limit loop
  v_allowed_until:=v_allowed_until+1;
  if extract(dow from v_allowed_until)<>6 then v_days:=v_days+1;end if;
 end loop;
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok';v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 if v_start_local::date<v_today+1 or v_start_local::date>v_allowed_until then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED';end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<time '08:00' or v_end_local::time>time '18:00' then raise exception 'OUTSIDE_SERVICE_HOURS';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text||':'||v_start_local::date::text,338));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then
  raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';
 end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,notes,status,requires_key,is_priority)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),p_notes,'APPROVED',false,public.has_permission('BOOKING_OVERRIDE'))
 returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason)
 values(v_booking.id,'APPROVED',v_actor,'Meeting booking automatically confirmed by approved baseline');
 perform public.write_audit(v_actor,'MEETING_BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id));
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.enforce_meeting_booking_role()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_scope text;
begin
 select rt.usage_scope into v_scope from public.rooms r join public.room_types rt on rt.id=r.room_type_id where r.id=new.room_id;
 if v_scope='MEETING' and new.status in('PENDING','APPROVED','IN_USE') and coalesce(auth.role(),'')<>'service_role'
  and not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 return new;
end $$;
create trigger enforce_meeting_booking_role before insert or update of room_id,status on public.bookings
for each row execute function public.enforce_meeting_booking_role();

create or replace function public.upsert_announcement(
 p_id uuid,p_title text,p_body text,p_audience text,p_active boolean,p_visible_from timestamptz,p_visible_until timestamptz
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_id uuid:=coalesce(p_id,extensions.gen_random_uuid());
begin
 if v_actor is null or not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_id is null then
  insert into public.announcements(id,title,body,audience,active,visible_from,visible_until,created_by)
  values(v_id,btrim(p_title),btrim(p_body),upper(btrim(p_audience)),p_active,p_visible_from,p_visible_until,v_actor);
 else
  update public.announcements set title=btrim(p_title),body=btrim(p_body),audience=upper(btrim(p_audience)),
   active=p_active,visible_from=p_visible_from,visible_until=p_visible_until where id=p_id;
  if not found then raise exception 'ANNOUNCEMENT_NOT_FOUND';end if;
 end if;
 perform public.write_audit(v_actor,case when p_id is null then 'ANNOUNCEMENT_CREATED' else 'ANNOUNCEMENT_UPDATED' end,
  'announcement',v_id,jsonb_build_object('active',p_active,'audience',upper(btrim(p_audience))));
 return v_id;
end $$;

create trigger append_key_request_history
after insert or update of status on public.key_requests
for each row execute function public.append_key_request_history();

create or replace function public.create_key_request(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_purpose_type text,p_purpose text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_course_code text default null,p_course_name text default null,
 p_lecturer_name text default null,p_lecturer_email text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_type public.room_types;v_request public.key_requests;v_room_mode text;v_profile public.profiles;
 v_today date:=(now() at time zone 'Asia/Bangkok')::date;
begin
 if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE';end if;
 if (p_starts_at at time zone 'Asia/Bangkok')::date<>v_today or (p_ends_at at time zone 'Asia/Bangkok')::date<>v_today then
  raise exception 'KEY_REQUEST_CURRENT_DAY_ONLY';
 end if;
 if (p_starts_at at time zone 'Asia/Bangkok')::time<time '08:00' or (p_ends_at at time zone 'Asia/Bangkok')::time>time '18:00' then
  raise exception 'OUTSIDE_SERVICE_HOURS';
 end if;
 select rt.* into v_type from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 where r.id=p_room_id and r.active and r.booking_enabled for share of r;
 if not found or v_type.usage_scope<>'LABORATORY' then raise exception 'ROOM_NOT_AVAILABLE';end if;
 if v_type.requires_sso_for_key_request and v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select r.key_approval_mode into v_room_mode from public.rooms r where r.id=p_room_id;
 if v_actor is not null then
  select * into v_profile from public.profiles p where p.id=v_actor and p.account_status='ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
  if v_type.requires_sso_for_key_request then
   p_requester_name:=v_profile.full_name;p_requester_email:=v_profile.email;
  end if;
 end if;

 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,336));
 if exists(
  select 1 from public.key_loans l left join public.bookings b on b.id=l.booking_id
  where l.room_id=p_room_id and l.status in('REQUESTED','APPROVED','CHECKED_OUT','LATE')
   and tstzrange(coalesce(b.starts_at,l.checked_out_at,l.requested_at),coalesce(b.ends_at,l.expected_return_at,l.requested_at+interval '1 minute'),'[)')
    &&tstzrange(p_starts_at,p_ends_at,'[)')
 ) then raise exception 'LEGACY_KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';end if;
 begin
  insert into public.key_requests(
   room_id,authenticated_user_id,requester_name,requester_email,purpose_type,purpose,
   course_code,course_name,lecturer_name,lecturer_email,starts_at,ends_at,status,approval_mode
  ) values(
   p_room_id,v_actor,btrim(p_requester_name),lower(btrim(p_requester_email)),upper(btrim(p_purpose_type)),btrim(p_purpose),
   nullif(btrim(p_course_code),''),nullif(btrim(p_course_name),''),nullif(btrim(p_lecturer_name),''),lower(nullif(btrim(p_lecturer_email),'')),
   p_starts_at,p_ends_at,case when coalesce(nullif(v_room_mode,'INHERIT'),v_type.default_key_approval_mode)='AUTO' then 'APPROVED' else 'PENDING_APPROVAL' end,
   coalesce(nullif(v_room_mode,'INHERIT'),v_type.default_key_approval_mode)
  ) returning * into v_request;
 exception when exclusion_violation then
  raise exception 'KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';
 end;

 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 values('KEY_REQUEST_SUBMITTED',v_request.requester_email,'key_request',v_request.id,'key-request-submitted',
  jsonb_build_object('request_code',v_request.request_code,'status',v_request.status,'action_bundle_required',true),
  'key-request:'||v_request.id||':submitted') on conflict(idempotency_key) do nothing;
 if v_request.purpose_type='TEACHING' and v_request.lecturer_email is not null then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
  values('KEY_REQUEST_LECTURER_NOTICE',v_request.lecturer_email,'key_request',v_request.id,'key-request-lecturer-notice',
   jsonb_build_object('request_code',v_request.request_code),
   'key-request:'||v_request.id||':lecturer-submitted') on conflict(idempotency_key) do nothing;
 end if;
 perform public.write_audit(v_actor,'KEY_REQUEST_CREATED','key_request',v_request.id,
  jsonb_build_object('room_id',p_room_id,'status',v_request.status,'anonymous',v_actor is null));
 return jsonb_build_object('id',v_request.id,'request_code',v_request.request_code,'status',v_request.status);
end $$;

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
 update public.key_requests set status=v_next,decided_at=now(),decided_by=v_actor,decision_reason=nullif(btrim(p_reason),'')
 where id=p_key_request_id returning * into v_request;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 values('KEY_REQUEST_'||v_next,v_request.requester_email,'key_request',v_request.id,'key-request-'||lower(v_next),
  jsonb_build_object('request_code',v_request.request_code,'reason',v_request.decision_reason),
  'key-request:'||v_request.id||':decision:'||lower(v_next)) on conflict(idempotency_key) do nothing;
 perform public.write_audit(v_actor,'KEY_REQUEST_'||v_next,'key_request',v_request.id,jsonb_build_object('reason',v_request.decision_reason));
 return jsonb_build_object('id',v_request.id,'status',v_request.status);
end $$;

create or replace function public.register_key_request_action_token(
 p_key_request_id uuid,p_action text,p_raw_token text,p_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_action text:=upper(btrim(p_action));
begin
 if coalesce(auth.role(),'')<>'service_role' and (auth.uid() is null or not public.has_permission('KEY_MANAGE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if v_action not in('TRACK','CANCEL','RETURN') then raise exception 'INVALID_TOKEN_ACTION';end if;
 if length(p_raw_token)<32 then raise exception 'TOKEN_TOO_SHORT';end if;
 if p_expires_at<=now() then raise exception 'TOKEN_ALREADY_EXPIRED';end if;
 insert into public.secure_action_tokens(key_request_id,action,token_digest,expires_at)
 values(p_key_request_id,v_action,extensions.digest(convert_to(p_raw_token,'UTF8'),'sha256'),p_expires_at) returning id into v_id;
 return v_id;
end $$;

create or replace function public.issue_key_request_action_bundle(p_key_request_id uuid,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_track text;v_cancel text;v_return text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_expires_at<=now() then raise exception 'TOKEN_ALREADY_EXPIRED';end if;
 if not exists(select 1 from public.key_requests where id=p_key_request_id) then raise exception 'KEY_REQUEST_NOT_FOUND';end if;
 v_track:=extensions.encode(extensions.gen_random_bytes(32),'hex');
 v_cancel:=extensions.encode(extensions.gen_random_bytes(32),'hex');
 v_return:=extensions.encode(extensions.gen_random_bytes(32),'hex');
 insert into public.secure_action_tokens(key_request_id,action,token_digest,expires_at) values
  (p_key_request_id,'TRACK',extensions.digest(convert_to(v_track,'UTF8'),'sha256'),p_expires_at),
  (p_key_request_id,'CANCEL',extensions.digest(convert_to(v_cancel,'UTF8'),'sha256'),p_expires_at),
  (p_key_request_id,'RETURN',extensions.digest(convert_to(v_return,'UTF8'),'sha256'),p_expires_at);
 return jsonb_build_object('track_token',v_track,'cancel_token',v_cancel,'return_token',v_return,'expires_at',p_expires_at);
end $$;

create or replace function public.consume_key_request_action(p_raw_token text,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token public.secure_action_tokens;v_request public.key_requests;v_action text:=upper(btrim(p_action));
begin
 select * into v_token from public.secure_action_tokens
 where token_digest=extensions.digest(convert_to(p_raw_token,'UTF8'),'sha256') and action=v_action for update;
 if not found then raise exception 'INVALID_ACTION_TOKEN' using errcode='42501';end if;
 if v_token.used_at is not null then raise exception 'ACTION_TOKEN_ALREADY_USED' using errcode='42501';end if;
 if v_token.expires_at<=now() then raise exception 'ACTION_TOKEN_EXPIRED' using errcode='42501';end if;
 select * into v_request from public.key_requests where id=v_token.key_request_id for update;
 if not found then raise exception 'KEY_REQUEST_NOT_FOUND';end if;

 if v_action='TRACK' then
  update public.secure_action_tokens set used_at=now() where id=v_token.id;
  return jsonb_build_object('request_code',v_request.request_code,'status',v_request.status,'starts_at',v_request.starts_at,'ends_at',v_request.ends_at);
 elsif v_action='CANCEL' then
  if v_request.status not in('PENDING_APPROVAL','APPROVED','IN_USE') or now()>=v_request.ends_at then raise exception 'KEY_REQUEST_NOT_CANCELLABLE';end if;
  perform set_config('app.key_request_actor_kind','TOKEN',true);
  update public.key_requests set status='CANCELLED',cancelled_at=now() where id=v_request.id returning * into v_request;
 elsif v_action='RETURN' then
  if v_request.status not in('APPROVED','IN_USE') or now()<v_request.starts_at then raise exception 'KEY_REQUEST_NOT_RETURNABLE';end if;
  perform set_config('app.key_request_actor_kind','TOKEN',true);
  update public.key_requests set status='RETURNED',returned_at=now() where id=v_request.id returning * into v_request;
 else raise exception 'INVALID_TOKEN_ACTION';
 end if;
 update public.secure_action_tokens set used_at=now() where id=v_token.id;
 perform public.write_audit(null,'KEY_REQUEST_TOKEN_'||v_action,'key_request',v_request.id,jsonb_build_object('token_id',v_token.id));
 return jsonb_build_object('request_code',v_request.request_code,'status',v_request.status,'effective_at',now());
end $$;

insert into public.booking_segments(booking_id,room_id,starts_at,ends_at,segment_status)
select b.id,b.room_id,b.starts_at,b.ends_at,'ACTIVE' from public.bookings b
where b.status in('PENDING','APPROVED','IN_USE') and not exists(select 1 from public.booking_segments s where s.booking_id=b.id);

create or replace function public.ensure_booking_segment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in('PENDING','APPROVED','IN_USE') then
  insert into public.booking_segments(booking_id,room_id,starts_at,ends_at)
  select new.id,new.room_id,new.starts_at,new.ends_at
  where not exists(select 1 from public.booking_segments where booking_id=new.id);
 end if;
 return new;
end $$;
create trigger ensure_booking_segment after insert on public.bookings
for each row execute function public.ensure_booking_segment();

create or replace function public.sync_booking_segments()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.room_id is distinct from new.room_id or old.starts_at is distinct from new.starts_at or old.ends_at is distinct from new.ends_at then
  if exists(select 1 from public.booking_segments where booking_id=old.id and segment_status='SUPERSEDED') then
   raise exception 'SEGMENTED_BOOKING_REQUIRES_SEGMENT_AWARE_EDIT';
  end if;
  update public.booking_segments set room_id=new.room_id,starts_at=new.starts_at,ends_at=new.ends_at
  where booking_id=new.id and segment_status='ACTIVE';
 end if;
 if old.status is distinct from new.status and new.status not in('PENDING','APPROVED','IN_USE')
  and current_setting('app.priority_override',true) is distinct from 'true' then
  update public.booking_segments set segment_status='CANCELLED' where booking_id=new.id and segment_status='ACTIVE';
 end if;
 return new;
end $$;
create trigger sync_booking_segments before update of room_id,starts_at,ends_at,status on public.bookings
for each row execute function public.sync_booking_segments();

create or replace function public.prevent_legacy_key_overlap_with_baseline()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_start timestamptz;v_end timestamptz;
begin
 if new.status not in('REQUESTED','APPROVED','CHECKED_OUT','LATE') then return new;end if;
 select coalesce(b.starts_at,new.checked_out_at,new.requested_at),coalesce(b.ends_at,new.expected_return_at,new.requested_at+interval '1 minute')
 into v_start,v_end from (select 1) x left join public.bookings b on b.id=new.booking_id;
 perform pg_advisory_xact_lock(hashtextextended(new.room_id::text,336));
 if exists(select 1 from public.key_requests r where r.room_id=new.room_id and r.status in('PENDING_APPROVAL','APPROVED','IN_USE')
  and tstzrange(r.starts_at,r.ends_at,'[)')&&tstzrange(v_start,v_end,'[)')) then
  raise exception 'BASELINE_KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';
 end if;
 return new;
end $$;
create trigger prevent_legacy_key_overlap_with_baseline before insert or update of room_id,status,booking_id,expected_return_at on public.key_loans
for each row execute function public.prevent_legacy_key_overlap_with_baseline();

create or replace function public.create_priority_booking_override(
 p_displaced_booking_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_reason text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_old public.bookings;v_priority public.bookings;v_left uuid;v_right uuid;
begin
 if v_actor is null or not public.has_permission('BOOKING_OVERRIDE') or
  not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_ends_at<=p_starts_at or nullif(btrim(p_purpose),'') is null or nullif(btrim(p_reason),'') is null then raise exception 'INVALID_OVERRIDE_INPUT';end if;
 select * into v_old from public.bookings where id=p_displaced_booking_id for update;
 if not found or v_old.status not in('APPROVED','IN_USE') or v_old.is_priority then raise exception 'BOOKING_NOT_OVERRIDEABLE';end if;
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
 return jsonb_build_object('priority_booking_id',v_priority.id,'left_booking_id',v_left,'right_booking_id',v_right);
end $$;

create or replace function public.claim_notification_outbox(p_worker_id text,p_limit integer default 20)
returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if nullif(btrim(p_worker_id),'') is null or p_limit not between 1 and 100 then raise exception 'INVALID_CLAIM_PARAMETERS';end if;
 return query
 with candidates as (
  select id from public.notification_outbox
  where (status in('PENDING','FAILED') or (status='PROCESSING' and lease_expires_at<=now()))
   and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts
  order by scheduled_at,id for update skip locked limit p_limit
 )
 update public.notification_outbox o set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),
  lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id
 from candidates c where o.id=c.id returning o.*;
end $$;

create or replace function public.complete_notification_outbox(
 p_outbox_id uuid,p_succeeded boolean,p_error text default null,p_provider_message_id text default null
)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update public.notification_outbox set
  status=case when p_succeeded then 'SENT' when attempt_count>=max_attempts then 'DEAD' else 'FAILED' end,
  sent_at=case when p_succeeded then now() else null end,
  provider_message_id=case when p_succeeded then nullif(btrim(p_provider_message_id),'') else provider_message_id end,
  last_error=case when p_succeeded then null else left(coalesce(p_error,'Unknown delivery failure'),2000) end,
  next_attempt_at=case when p_succeeded then next_attempt_at else now()+make_interval(mins=>least(60,power(2,least(attempt_count,5))::integer)) end,
  locked_at=null,lease_expires_at=null,locked_by=null where id=p_outbox_id and status='PROCESSING';
 if not found then raise exception 'OUTBOX_ITEM_NOT_PROCESSING';end if;
end $$;
