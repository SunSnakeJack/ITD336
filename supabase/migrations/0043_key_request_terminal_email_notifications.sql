create or replace function public.enqueue_key_request_terminal_email()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.status is distinct from new.status and new.status='CANCELLED' then
    insert into public.notification_outbox(
      notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key
    ) values(
      'KEY_REQUEST_CANCELLED',new.requester_email,'key_request',new.id,'key-request-cancelled',
      jsonb_build_object('request_code',new.request_code,'status',new.status),
      'key-request:'||new.id||':cancelled'
    ) on conflict(idempotency_key) do nothing;
  elsif old.status is distinct from new.status and new.status='RETURNED' then
    insert into public.notification_outbox(
      notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key
    ) values(
      'KEY_REQUEST_RETURNED',new.requester_email,'key_request',new.id,'key-request-returned',
      jsonb_build_object('request_code',new.request_code,'status',new.status),
      'key-request:'||new.id||':returned'
    ) on conflict(idempotency_key) do nothing;
  end if;
  return new;
end
$$;

drop trigger if exists enqueue_key_request_terminal_email on public.key_requests;
create trigger enqueue_key_request_terminal_email
after update of status on public.key_requests
for each row execute function public.enqueue_key_request_terminal_email();

revoke all on function public.enqueue_key_request_terminal_email() from public,anon,authenticated;
