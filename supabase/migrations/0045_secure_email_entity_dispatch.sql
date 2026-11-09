create table public.email_dispatch_tokens(
  key_request_id uuid primary key references public.key_requests(id) on delete cascade,
  token_digest bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_dispatch_tokens enable row level security;
revoke all on public.email_dispatch_tokens from public,anon,authenticated;

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

create or replace function public.claim_notification_outbox_entity_test(
 p_worker_id text,p_recipient text,p_entity_id uuid,p_dispatch_token text,p_limit integer default 10
)
returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$
declare v_token public.email_dispatch_tokens;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if nullif(btrim(p_worker_id),'') is null or nullif(btrim(p_recipient),'') is null or length(coalesce(p_dispatch_token,''))<32 or p_limit not between 1 and 20 then raise exception 'INVALID_CLAIM_PARAMETERS';end if;
 select * into v_token from public.email_dispatch_tokens where key_request_id=p_entity_id and token_digest=extensions.digest(pg_catalog.convert_to(p_dispatch_token,'UTF8'),'sha256') for update;
 if not found then raise exception 'INVALID_ACTION_TOKEN' using errcode='42501';end if;
 if v_token.used_at is not null then raise exception 'ACTION_TOKEN_ALREADY_USED' using errcode='42501';end if;
 if v_token.expires_at<=now() then raise exception 'ACTION_TOKEN_EXPIRED' using errcode='42501';end if;
 update public.email_dispatch_tokens set used_at=now() where key_request_id=p_entity_id;
 return query with candidates as(
  select id from public.notification_outbox where lower(recipient_email)=lower(btrim(p_recipient)) and entity_type='key_request' and entity_id=p_entity_id
   and(status in('PENDING','FAILED') or(status='PROCESSING' and lease_expires_at<=now())) and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts
  order by scheduled_at,id for update skip locked limit p_limit
 ) update public.notification_outbox o set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id from candidates c where o.id=c.id returning o.*;
end $$;

revoke all on function public.claim_notification_outbox_entity_test(text,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.claim_notification_outbox_entity_test(text,text,uuid,text,integer) to service_role;
