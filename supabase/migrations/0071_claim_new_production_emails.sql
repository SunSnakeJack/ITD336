-- Claim only new, supported messages. An uncertain provider outcome requires
-- reconciliation rather than automatic resend after an expired lease.
create function public.claim_new_production_emails(p_worker_id text,p_start_at timestamptz)
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
 return query
 with candidates as (
  select id from public.notification_outbox
  where created_at>=p_start_at and scheduled_at>=p_start_at
   and status='PENDING' and attempt_count=0
   and scheduled_at<=now() and next_attempt_at<=now()
   and (
    (entity_type='booking' and template_key in ('booking-submitted','booking-approved','booking-rejected','booking-cancelled','booking-starting-soon'))
    or (entity_type='key_request' and template_key in ('key-request-submitted','key-request-approved','key-request-rejected','key-request-cancelled','key-request-returned','key-request-starting-soon','key-request-ending-soon','key-request-ended','key-request-lecturer-notice','key-request-admin-notice'))
   )
  order by scheduled_at,id for update skip locked limit 10
 )
 update public.notification_outbox o set status='PROCESSING',attempt_count=1,max_attempts=1,
 locked_at=now(),lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id
 from candidates c where o.id=c.id returning o.*;
end $$;
revoke all on function public.claim_new_production_emails(text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_new_production_emails(text,timestamptz) to service_role;
