create function public.enqueue_request_change_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_template text;
  v_email text;
  v_reason text;
begin
  if TG_TABLE_NAME = 'bookings' then
    if new.status = 'SUPERSEDED' and old.status is distinct from new.status then
      v_template := 'booking-superseded';
      v_reason := new.override_reason;
    elsif new.status in ('PENDING','APPROVED') and
      (old.starts_at,old.ends_at,old.purpose) is distinct from (new.starts_at,new.ends_at,new.purpose) then
      v_template := 'booking-updated';
    end if;
    select email into v_email from public.profiles where id=new.requester_id;
  elsif new.status in ('PENDING_APPROVAL','APPROVED') and
    (old.starts_at,old.ends_at,old.purpose) is distinct from (new.starts_at,new.ends_at,new.purpose) then
    v_template := 'key-request-updated';
    v_email := new.requester_email;
  end if;
  if v_template is not null and nullif(btrim(v_email),'') is not null then
    insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
    values(upper(replace(v_template,'-','_')),v_email,
      case when TG_TABLE_NAME='bookings' then 'booking' else 'key_request' end,
      new.id,v_template,jsonb_build_object('starts_at',new.starts_at,'ends_at',new.ends_at,
        'purpose',new.purpose,'status',new.status,'reason',v_reason),
      v_template||':'||new.id||':'||gen_random_uuid());
  end if;
  return new;
end $$;

revoke all on function public.enqueue_request_change_email() from public,anon,authenticated;
create trigger booking_change_email after update on public.bookings
for each row execute function public.enqueue_request_change_email();
create trigger key_request_change_email after update on public.key_requests
for each row execute function public.enqueue_request_change_email();

create function public.enqueue_key_email_deadlines(p_cutoff timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
  select upper(replace(e.template,'-','_')),k.requester_email,'key_request',k.id,e.template,
    jsonb_build_object('status',e.status),'key-request:'||k.id||':'||e.template
  from public.key_requests k
  join public.rooms r on r.id=k.room_id
  join public.room_types rt on rt.id=r.room_type_id
  cross join lateral (
    select 'key-request-expired' as template,'EXPIRED' as status
    where k.status='PENDING_APPROVAL' and rt.report_category='SPECIAL_LAB'
    union all
    select 'key-request-overdue','OVERDUE' where k.status in ('APPROVED','IN_USE') and k.returned_at is null
  ) e
  where k.ends_at>=p_cutoff and k.ends_at>now()-interval '1 day' and k.ends_at<=now()
  on conflict (idempotency_key) do nothing;
end $$;

revoke all on function public.enqueue_key_email_deadlines(timestamptz) from public,anon,authenticated;

create function public.preview_key_request_email_action(p_raw_token text,p_action text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('requestCode',k.request_code,'room',r.code,'startsAt',k.starts_at,'endsAt',k.ends_at,
    'ownerId',k.authenticated_user_id,'ownerEmail',lower(btrim(k.requester_email)))
  from public.secure_action_tokens t
  join public.key_requests k on k.id=t.key_request_id
  join public.rooms r on r.id=k.room_id
  where coalesce(auth.role(),'')='service_role'
    and t.token_digest=extensions.digest(convert_to(p_raw_token,'UTF8'),'sha256')
    and t.action=p_action and t.action in ('CANCEL','RETURN')
    and t.used_at is null and t.expires_at>now();
$$;

revoke all on function public.preview_key_request_email_action(text,text) from public,anon,authenticated;
grant execute on function public.preview_key_request_email_action(text,text) to service_role;

-- The website submits confirmed actions through the Edge Function.
revoke all on function public.consume_key_request_action(text,text) from public,anon,authenticated;
grant execute on function public.consume_key_request_action(text,text) to service_role;
create or replace function public.claim_new_production_emails(p_worker_id text,p_start_at timestamptz)
returns setof public.notification_outbox
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if nullif(btrim(p_worker_id),'') is null or p_start_at is null
    or not pg_catalog.isfinite(p_start_at) then
  raise exception 'INVALID_CLAIM_PARAMETERS';
 end if;
 perform public.enqueue_key_email_deadlines(p_start_at);
 return query
 with candidates as (
  select q.id from public.notification_outbox q
  where created_at>=p_start_at and scheduled_at>=p_start_at
   and status='PENDING' and attempt_count=0
   and scheduled_at<=now() and next_attempt_at<=now()
   and (
    (entity_type='booking' and (
     template_key in ('booking-cancelled','booking-starting-soon','booking-updated','booking-superseded')
     or (template_key='booking-submitted' and payload->>'status'='APPROVED')
     or (template_key in ('booking-submitted','booking-approved','booking-rejected') and exists (
      select 1 from public.bookings b
      join public.rooms r on r.id=b.room_id
      join public.room_types rt on rt.id=r.room_type_id
      where b.id=q.entity_id and rt.usage_scope<>'MEETING'
     ))
    ))
    or (entity_type='key_request' and template_key in ('key-request-submitted','key-request-approved','key-request-rejected','key-request-cancelled','key-request-returned','key-request-starting-soon','key-request-ending-soon','key-request-ended','key-request-lecturer-notice','key-request-admin-notice','key-request-updated','key-request-expired','key-request-overdue'))
   )
  order by scheduled_at,id for update skip locked limit 10
 )
 update public.notification_outbox o set status='PROCESSING',attempt_count=1,max_attempts=1,
 locked_at=now(),lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id
 from candidates c where o.id=c.id returning o.*;
end $$;
revoke all on function public.claim_new_production_emails(text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_new_production_emails(text,timestamptz) to service_role;
