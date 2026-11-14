create or replace function public.enqueue_booking_email_events()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_email text; v_template text;
begin
 select email into v_email from public.profiles where id=new.requester_id;
 if nullif(btrim(v_email),'') is null then return new;end if;
 if tg_op='INSERT' then v_template:='booking-submitted';
 elsif old.status is distinct from new.status and new.status::text in ('APPROVED','REJECTED','CANCELLED') then
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
create trigger enqueue_booking_email_events after insert or update of status,starts_at,ends_at on public.bookings for each row execute function public.enqueue_booking_email_events();
revoke all on function public.enqueue_booking_email_events() from public,anon,authenticated;

create or replace function public.get_booking_email_context(p_booking_id uuid)
returns table(request_code text,status text,starts_at timestamptz,ends_at timestamptz,purpose text,decision_reason text,room_name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select b.booking_code,b.status::text,b.starts_at,b.ends_at,b.purpose,
 coalesce(b.cancel_reason,(select h.reason from public.booking_status_history h where h.booking_id=b.id order by h.created_at desc limit 1)),r.name
 from public.bookings b join public.rooms r on r.id=b.room_id where b.id=p_booking_id;
end $$;
revoke all on function public.get_booking_email_context(uuid) from public,anon,authenticated;
grant execute on function public.get_booking_email_context(uuid) to service_role;
