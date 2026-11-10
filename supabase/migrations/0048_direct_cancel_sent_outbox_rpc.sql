create or replace function public.get_direct_cancel_sent_outbox(
 p_key_request_id uuid,p_recipient_email text
)
returns table(outbox_id uuid)
language plpgsql security definer set search_path='' stable as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_key_request_id is null or nullif(btrim(p_recipient_email),'') is null then raise exception 'INVALID_PARAMETERS';end if;
 return query
 select o.id from public.notification_outbox o
 where o.entity_type='key_request' and o.entity_id=p_key_request_id
  and o.template_key='key-request-submitted' and o.status='SENT'
  and lower(o.recipient_email)=lower(btrim(p_recipient_email))
 order by o.created_at desc limit 1;
end $$;

revoke all on function public.get_direct_cancel_sent_outbox(uuid,text) from public,anon,authenticated;
grant execute on function public.get_direct_cancel_sent_outbox(uuid,text) to service_role;
