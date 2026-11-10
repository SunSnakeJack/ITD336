create table public.gmail_action_test_nonces(
  nonce_digest bytea primary key,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now()
);
alter table public.gmail_action_test_nonces enable row level security;
revoke all on public.gmail_action_test_nonces from public,anon,authenticated;

create or replace function public.consume_gmail_action_test_nonce(p_jti text,p_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_inserted integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if nullif(btrim(p_jti),'') is null or length(p_jti)>128 or p_expires_at<=now() or p_expires_at>now()+interval '15 minutes' then return false;end if;
  delete from public.gmail_action_test_nonces where expires_at<=now();
  insert into public.gmail_action_test_nonces(nonce_digest,expires_at)
  values(extensions.digest(pg_catalog.convert_to(p_jti,'UTF8'),'sha256'),p_expires_at)
  on conflict do nothing;
  get diagnostics v_inserted=row_count;
  return v_inserted=1;
end $$;

revoke all on function public.consume_gmail_action_test_nonce(text,timestamptz) from public,anon,authenticated;
grant execute on function public.consume_gmail_action_test_nonce(text,timestamptz) to service_role;
