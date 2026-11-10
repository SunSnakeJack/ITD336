create table public.gmail_key_action_tokens(
  secure_action_token_id uuid primary key references public.secure_action_tokens(id) on delete cascade,
  outbox_id uuid not null unique references public.notification_outbox(id) on delete cascade,
  recipient_email_digest bytea not null,
  created_at timestamptz not null default now()
);
alter table public.gmail_key_action_tokens enable row level security;
revoke all on public.gmail_key_action_tokens from public,anon,authenticated;

create or replace function public.issue_gmail_key_action_token(
  p_outbox_id uuid,p_key_request_id uuid,p_recipient_email text,p_action text,p_expires_at timestamptz,p_raw_token text
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_action text:=upper(btrim(p_action));v_token_id uuid;v_bound_token_id uuid;v_request public.key_requests;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if v_action not in('CANCEL','RETURN') or length(coalesce(p_raw_token,''))<32 or p_expires_at<=now() then raise exception 'INVALID_GMAIL_ACTION_TOKEN';end if;
  select * into v_request from public.key_requests where id=p_key_request_id;
  if not found or extensions.digest(pg_catalog.convert_to(lower(btrim(p_recipient_email)),'UTF8'),'sha256')<>extensions.digest(pg_catalog.convert_to(lower(v_request.requester_email),'UTF8'),'sha256') then raise exception 'RECIPIENT_MISMATCH';end if;
  if not exists(select 1 from public.notification_outbox where id=p_outbox_id and entity_type='key_request' and entity_id=p_key_request_id and lower(recipient_email)=lower(btrim(p_recipient_email))) then raise exception 'OUTBOX_MISMATCH';end if;
  insert into public.secure_action_tokens(key_request_id,action,token_digest,expires_at)
  values(p_key_request_id,v_action,extensions.digest(pg_catalog.convert_to(p_raw_token,'UTF8'),'sha256'),p_expires_at)
  on conflict(token_digest) do update set token_digest=excluded.token_digest returning id into v_token_id;
  insert into public.gmail_key_action_tokens(secure_action_token_id,outbox_id,recipient_email_digest)
  values(v_token_id,p_outbox_id,extensions.digest(pg_catalog.convert_to(lower(btrim(p_recipient_email)),'UTF8'),'sha256'))
  on conflict(outbox_id) do nothing;
  select secure_action_token_id into v_bound_token_id from public.gmail_key_action_tokens where outbox_id=p_outbox_id;
  if v_bound_token_id<>v_token_id then raise exception 'OUTBOX_TOKEN_MISMATCH';end if;
  return true;
end $$;

create or replace function public.consume_gmail_key_action(
  p_raw_token text,p_action text,p_outbox_id uuid,p_key_request_id uuid,p_recipient_digest text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_recipient_email_digest bytea;v_request public.key_requests;v_action text:=upper(btrim(p_action));
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if v_action not in('CANCEL','RETURN') or p_recipient_digest!~'^[0-9a-fA-F]{64}$' then raise exception 'INVALID_GMAIL_ACTION_TOKEN';end if;
  select g.recipient_email_digest into v_recipient_email_digest from public.secure_action_tokens s join public.gmail_key_action_tokens g on g.secure_action_token_id=s.id
  where s.token_digest=extensions.digest(pg_catalog.convert_to(p_raw_token,'UTF8'),'sha256') and s.action=v_action and s.key_request_id=p_key_request_id and g.outbox_id=p_outbox_id
  for update of s,g;
  if not found then raise exception 'INVALID_ACTION_TOKEN' using errcode='42501';end if;
  select * into v_request from public.key_requests where id=p_key_request_id for update;
  if not found or v_recipient_email_digest<>pg_catalog.decode(lower(p_recipient_digest),'hex') or v_recipient_email_digest<>extensions.digest(pg_catalog.convert_to(lower(v_request.requester_email),'UTF8'),'sha256') then raise exception 'RECIPIENT_MISMATCH' using errcode='42501';end if;
  return public.consume_key_request_action(p_raw_token,p_action);
end $$;

revoke all on function public.issue_gmail_key_action_token(uuid,uuid,text,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.consume_gmail_key_action(text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_gmail_key_action_token(uuid,uuid,text,text,timestamptz,text) to service_role;
grant execute on function public.consume_gmail_key_action(text,text,uuid,uuid,text) to service_role;
