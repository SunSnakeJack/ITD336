-- Email-only change. Keep existing outbox history and filter obsolete rows at claim time.
create or replace function public.enqueue_booking_email_events()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_template text; v_is_meeting boolean;
begin
 select email into v_email from public.profiles where id=new.requester_id;
 if nullif(btrim(v_email),'') is null then return new;end if;
 select rt.usage_scope='MEETING' into v_is_meeting
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 where r.id=new.room_id;
 if tg_op='INSERT' then
  if v_is_meeting is not true or new.status='APPROVED' then v_template:='booking-submitted'; end if;
 elsif old.status is distinct from new.status and (
  new.status='CANCELLED' or (v_is_meeting is not true and new.status in ('APPROVED','REJECTED'))
 ) then
  v_template:='booking-'||lower(new.status::text);
 end if;
 if v_template is not null then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
  values(upper(replace(v_template,'-','_')),v_email,'booking',new.id,v_template,jsonb_build_object('status',new.status),new.id||':'||v_template)
  on conflict(idempotency_key) do nothing;
 end if;
 if new.status::text='APPROVED' and new.starts_at>now() then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,scheduled_at,next_attempt_at,idempotency_key)
  values('BOOKING_STARTING_SOON',v_email,'booking',new.id,'booking-starting-soon','{}',greatest(now(),new.starts_at-interval '30 minutes'),greatest(now(),new.starts_at-interval '30 minutes'),new.id||':booking-starting-soon')
  on conflict(idempotency_key) do update set scheduled_at=excluded.scheduled_at,next_attempt_at=excluded.next_attempt_at where notification_outbox.status in ('PENDING','FAILED');
 else update public.notification_outbox set status='CANCELLED' where entity_type='booking' and entity_id=new.id and template_key='booking-starting-soon' and status in ('PENDING','FAILED');end if;
 return new;
end $$;

-- Claim only new, supported messages. An uncertain provider outcome requires
-- reconciliation rather than automatic resend after an expired lease.
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
 return query
 with candidates as (
  select q.id from public.notification_outbox q
  where created_at>=p_start_at and scheduled_at>=p_start_at
   and status='PENDING' and attempt_count=0
   and scheduled_at<=now() and next_attempt_at<=now()
   and (
    (entity_type='booking' and (
     template_key in ('booking-cancelled','booking-starting-soon')
     or (template_key='booking-submitted' and payload->>'status'='APPROVED')
     or (template_key in ('booking-submitted','booking-approved','booking-rejected') and exists (
      select 1 from public.bookings b
      join public.rooms r on r.id=b.room_id
      join public.room_types rt on rt.id=r.room_type_id
      where b.id=q.entity_id and rt.usage_scope<>'MEETING'
     ))
    ))
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
