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
 -- Only active reservations that have just started are eligible.
 insert into public.notification_outbox (
  notification_type, recipient_email, entity_type, entity_id, template_key,
  payload, scheduled_at, next_attempt_at, idempotency_key
 )
 select upper(replace(e.template, '-', '_')), e.email, e.entity, e.id, e.template,
  jsonb_build_object('starts_at', e.starts_at), e.starts_at, now(),
  e.entity || ':' || e.id || ':start-time'
 from (
  select b.id, p.email, b.starts_at, 'booking' as entity, 'booking-start-time' as template
  from public.bookings b
  join public.profiles p on p.id = b.requester_id
  where b.status in ('APPROVED','IN_USE') and b.ends_at > now()
    and b.starts_at > now() - interval '5 minutes' and b.starts_at between p_start_at and now()
  union all
  select k.id, k.requester_email, k.starts_at, 'key_request', 'key-request-start-time'
  from public.key_requests k
  where k.status in ('APPROVED','IN_USE') and k.ends_at > now()
    and k.starts_at > now() - interval '5 minutes' and k.starts_at between p_start_at and now()
 ) e
 where nullif(btrim(e.email), '') is not null
 on conflict (idempotency_key) do nothing;
 return query
 with candidates as (
  select q.id from public.notification_outbox q
  where created_at>=p_start_at and scheduled_at>=p_start_at
   and status='PENDING' and attempt_count=0
   and scheduled_at<=now() and next_attempt_at<=now()
   and (
    (entity_type='booking' and (
     template_key in ('booking-cancelled','booking-starting-soon','booking-start-time','booking-updated','booking-superseded')
     or (template_key='booking-submitted' and payload->>'status'='APPROVED')
     or (template_key in ('booking-submitted','booking-approved','booking-rejected') and exists (
      select 1 from public.bookings b
      join public.rooms r on r.id=b.room_id
      join public.room_types rt on rt.id=r.room_type_id
      where b.id=q.entity_id and rt.usage_scope<>'MEETING'
     ))
    ))
    or (entity_type='key_request' and template_key in ('key-request-submitted','key-request-approved','key-request-rejected','key-request-cancelled','key-request-returned','key-request-starting-soon','key-request-start-time','key-request-ending-soon','key-request-ended','key-request-lecturer-notice','key-request-admin-notice','key-request-updated','key-request-expired','key-request-overdue'))
   )
  order by scheduled_at,id for update skip locked limit 10
 )
 update public.notification_outbox o set status='PROCESSING',attempt_count=1,max_attempts=1,
 locked_at=now(),lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id
 from candidates c where o.id=c.id returning o.*;
end $$;
revoke all on function public.claim_new_production_emails(text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_new_production_emails(text,timestamptz) to service_role;

