create or replace function public.claim_notification_outbox_entity_test(
  p_worker_id text,
  p_recipient text,
  p_entity_id uuid,
  p_limit integer default 10
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path=''
as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if nullif(btrim(p_worker_id),'') is null or nullif(btrim(p_recipient),'') is null or p_limit not between 1 and 20 then
    raise exception 'INVALID_CLAIM_PARAMETERS';
  end if;
  return query
  with candidates as (
    select id
    from public.notification_outbox
    where lower(recipient_email)=lower(btrim(p_recipient))
      and entity_type='key_request'
      and entity_id=p_entity_id
      and (status in('PENDING','FAILED') or (status='PROCESSING' and lease_expires_at<=now()))
      and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts
    order by scheduled_at,id
    for update skip locked
    limit p_limit
  )
  update public.notification_outbox o
  set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),
      lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id
  from candidates c where o.id=c.id
  returning o.*;
end
$$;

revoke all on function public.claim_notification_outbox_entity_test(text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_notification_outbox_entity_test(text,text,uuid,integer) to service_role;
