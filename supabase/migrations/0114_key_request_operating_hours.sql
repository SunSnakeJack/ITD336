-- Resolve key-request hours from the same category used by restriction enforcement.
create function public.key_request_operating_hours(p_room_id uuid)
returns table(opens_at time, closes_at time)
language sql stable set search_path='' as $$
 select coalesce((p.policy->>'opensAt')::time,time '08:00'),
        coalesce((p.policy->>'closesAt')::time,time '18:00')
 from (select public.room_policy_category(p_room_id) as category) c
 left join public.room_category_restrictions p on p.category=c.category
$$;

create function public.get_public_key_operating_hours()
returns table(room_id uuid, opens_at time, closes_at time)
language sql stable security definer set search_path='' as $$
 select r.id,h.opens_at,h.closes_at
 from public.get_public_room_catalog() r
 cross join lateral public.key_request_operating_hours(r.id) h
 where r.usage_scope='LABORATORY'
$$;

-- A trigger keeps the configured time window authoritative for inserts and reschedules.
create function public.enforce_key_request_operating_hours()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_open time; v_close time;
begin
 if tg_op='UPDATE' and (old.room_id,old.starts_at,old.ends_at)
     is not distinct from (new.room_id,new.starts_at,new.ends_at) then return new; end if;
 select h.opens_at,h.closes_at into v_open,v_close
 from public.key_request_operating_hours(new.room_id) h;
 if (new.starts_at at time zone 'Asia/Bangkok')::time<v_open
     or (new.ends_at at time zone 'Asia/Bangkok')::time>v_close then
  raise exception 'OUTSIDE_OPERATING_HOURS' using errcode='22023';
 end if;
 return new;
end $$;

create trigger enforce_key_request_operating_hours
 before insert or update of room_id,starts_at,ends_at on public.key_requests
 for each row execute function public.enforce_key_request_operating_hours();

alter table public.key_requests drop constraint key_requests_service_hours;

-- The existing entry trigger still owns university email validation.
create or replace function public.enforce_key_request_entry_rules()
returns trigger language plpgsql set search_path='' as $$
begin
 new.requester_email := lower(btrim(new.requester_email));
 if new.requester_email !~ '^[^@[:space:]]+@northbkk[.]ac[.]th$' then
  raise exception 'UNIVERSITY_EMAIL_REQUIRED' using errcode='22023';
 end if;
 return new;
end $$;

revoke all on function public.key_request_operating_hours(uuid),
 public.enforce_key_request_operating_hours(),public.get_public_key_operating_hours()
 from public,anon,authenticated;
grant execute on function public.get_public_key_operating_hours() to anon,authenticated;

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

create or replace function public.get_own_request_edit_context(p_id uuid, p_type text)
returns table(room_id uuid, service_date date, opens_at time, closes_at time)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1 from public.profiles where id = v_actor and account_status = 'ACTIVE'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_type = 'booking' then
    return query
    select b.room_id, (b.starts_at at time zone 'Asia/Bangkok')::date,
      case when rt.usage_scope = 'MEETING' then time '08:00' else coalesce(
        (select (rule_value #>> '{}')::time from public.booking_rules where rule_key = 'GENERAL_OPEN_TIME' and active), time '08:30') end,
      case when rt.usage_scope = 'MEETING' then time '18:00' else coalesce(
        (select (rule_value #>> '{}')::time from public.booking_rules where rule_key = 'GENERAL_CLOSE_TIME' and active), time '17:30') end
    from public.bookings b
    join public.rooms r on r.id = b.room_id and r.active and r.booking_enabled
    join public.room_types rt on rt.id = r.room_type_id
    where b.id = p_id and b.requester_id = v_actor and b.starts_at > now()
      and b.status in ('PENDING', 'APPROVED');
  elsif p_type = 'key_request' then
    return query
    select k.room_id, (k.starts_at at time zone 'Asia/Bangkok')::date, h.opens_at, h.closes_at
    from public.key_requests k join public.rooms r on r.id = k.room_id and r.active
    cross join lateral public.key_request_operating_hours(k.room_id) h
    where k.id = p_id and k.starts_at > now() and k.status in ('PENDING_APPROVAL', 'APPROVED')
      and (k.authenticated_user_id = v_actor or (k.authenticated_user_id is null and exists (
        select 1 from auth.users u where u.id = v_actor and u.email_confirmed_at is not null
          and lower(u.email) = lower(k.requester_email)
      )));
  end if;
end;
$$;
