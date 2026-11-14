-- Future events only: do not send historical requests to new recipients.
create or replace function public.enqueue_key_request_additional_emails()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' and new.status='PENDING_APPROVAL' then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
  select distinct 'KEY_REQUEST_ADMIN_NOTICE',lower(p.email),'key_request',new.id,'key-request-admin-notice','{}'::jsonb,
   'key-request:'||new.id||':admin-notice:'||lower(p.email)
  from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.id=ur.role_id
  where r.code='ADMIN' and p.account_status='ACTIVE' and nullif(btrim(p.email),'') is not null
  on conflict(idempotency_key) do nothing;
 end if;
 if new.status in ('APPROVED','IN_USE') and new.starts_at>now() then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,scheduled_at,next_attempt_at,idempotency_key)
  values('KEY_REQUEST_STARTING_SOON',new.requester_email,'key_request',new.id,'key-request-starting-soon','{}',greatest(now(),new.starts_at-interval '30 minutes'),greatest(now(),new.starts_at-interval '30 minutes'),'key-request:'||new.id||':starting-soon')
  on conflict(idempotency_key) do update set scheduled_at=excluded.scheduled_at,next_attempt_at=excluded.next_attempt_at where notification_outbox.status in ('PENDING','FAILED');
 else
  update public.notification_outbox set status='CANCELLED' where entity_type='key_request' and entity_id=new.id and template_key='key-request-starting-soon' and status in ('PENDING','FAILED');
 end if;
 return new;
end $$;
create trigger enqueue_key_request_additional_emails after insert or update of status,starts_at,ends_at on public.key_requests
for each row execute function public.enqueue_key_request_additional_emails();
revoke all on function public.enqueue_key_request_additional_emails() from public,anon,authenticated;

-- Polling creates overdue events only while the key is still outstanding.
create or replace function public.enqueue_overdue_key_request_emails()
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 select 'KEY_REQUEST_OVERDUE',rec.email,'key_request',k.id,'key-request-overdue','{}',
 'key-request:'||k.id||':overdue:'||lower(rec.email)
 from public.key_requests k cross join lateral (
  select lower(k.requester_email) as email
  union select lower(p.email) from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.id=ur.role_id
  where r.code='ADMIN' and p.account_status='ACTIVE' and nullif(btrim(p.email),'') is not null
 ) rec
 where k.status in ('APPROVED','IN_USE') and k.ends_at<now()
 -- Avoid emailing an accumulated historical backlog when first enabled.
 and k.ends_at>now()-interval '1 day'
 on conflict(idempotency_key) do nothing;
end $$;
revoke all on function public.enqueue_overdue_key_request_emails() from public,anon,authenticated;
grant execute on function public.enqueue_overdue_key_request_emails() to service_role;
