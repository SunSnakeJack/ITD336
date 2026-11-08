create or replace function public.enqueue_key_request_timed_emails() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in('APPROVED','IN_USE') then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,scheduled_at,next_attempt_at,idempotency_key) values
   ('KEY_REQUEST_ENDING_SOON',new.requester_email,'key_request',new.id,'key-request-ending-soon',jsonb_build_object('request_code',new.request_code),greatest(now(),new.ends_at-interval '30 minutes'),greatest(now(),new.ends_at-interval '30 minutes'),'key-request:'||new.id||':ending-soon'),
   ('KEY_REQUEST_ENDED',new.requester_email,'key_request',new.id,'key-request-ended',jsonb_build_object('request_code',new.request_code),new.ends_at,new.ends_at,'key-request:'||new.id||':ended')
  on conflict(idempotency_key) do update set scheduled_at=excluded.scheduled_at,next_attempt_at=excluded.next_attempt_at where notification_outbox.status in('PENDING','FAILED');
 else update public.notification_outbox set status='CANCELLED' where entity_type='key_request' and entity_id=new.id and template_key in('key-request-ending-soon','key-request-ended') and status in('PENDING','FAILED');end if;
 return new;
end $$;
drop trigger if exists enqueue_key_request_timed_emails on public.key_requests;
create trigger enqueue_key_request_timed_emails after insert or update of status,starts_at,ends_at on public.key_requests for each row execute function public.enqueue_key_request_timed_emails();

insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,scheduled_at,next_attempt_at,idempotency_key)
select 'KEY_REQUEST_ENDING_SOON',k.requester_email,'key_request',k.id,'key-request-ending-soon',jsonb_build_object('request_code',k.request_code),greatest(now(),k.ends_at-interval '30 minutes'),greatest(now(),k.ends_at-interval '30 minutes'),'key-request:'||k.id||':ending-soon' from public.key_requests k where k.status in('APPROVED','IN_USE') and k.ends_at>now() on conflict(idempotency_key) do nothing;
insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,scheduled_at,next_attempt_at,idempotency_key)
select 'KEY_REQUEST_ENDED',k.requester_email,'key_request',k.id,'key-request-ended',jsonb_build_object('request_code',k.request_code),k.ends_at,k.ends_at,'key-request:'||k.id||':ended' from public.key_requests k where k.status in('APPROVED','IN_USE') and k.ends_at>now() on conflict(idempotency_key) do nothing;

create or replace function public.claim_notification_outbox_test(p_worker_id text,p_recipient text,p_limit integer default 20) returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if nullif(btrim(p_worker_id),'') is null or nullif(btrim(p_recipient),'') is null or p_limit not between 1 and 100 then raise exception 'INVALID_CLAIM_PARAMETERS';end if;
 return query with candidates as(select id from public.notification_outbox where lower(recipient_email)=lower(btrim(p_recipient)) and(status in('PENDING','FAILED') or(status='PROCESSING' and lease_expires_at<=now())) and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts order by scheduled_at,id for update skip locked limit p_limit)
 update public.notification_outbox o set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id from candidates c where o.id=c.id returning o.*;
end $$;
revoke all on function public.enqueue_key_request_timed_emails(),public.claim_notification_outbox_test(text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_notification_outbox_test(text,text,integer) to service_role;
