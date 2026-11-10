create or replace function public.claim_terminal_notification_outbox_retry(
 p_worker_id text,p_recipient text,p_entity_id uuid,p_template_key text
)
returns setof public.notification_outbox
language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if nullif(btrim(p_worker_id),'') is null or nullif(btrim(p_recipient),'') is null or p_entity_id is null
  or p_template_key not in('key-request-cancelled','key-request-returned') then raise exception 'INVALID_CLAIM_PARAMETERS';end if;
 return query with candidate as(
  select id from public.notification_outbox
  where lower(recipient_email)=lower(btrim(p_recipient)) and entity_type='key_request' and entity_id=p_entity_id
   and template_key=p_template_key
   and(status in('PENDING','FAILED') or(status='PROCESSING' and lease_expires_at<=now()))
   and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts
  order by scheduled_at,id for update skip locked limit 1
 ) update public.notification_outbox o
 set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id
 from candidate c where o.id=c.id returning o.*;
end $$;

revoke all on function public.claim_terminal_notification_outbox_retry(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_terminal_notification_outbox_retry(text,text,uuid,text) to service_role;
