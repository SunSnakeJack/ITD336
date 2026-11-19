create table public.preassigned_user_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email <> '' and email = lower(btrim(email))),
  full_name text not null check (btrim(full_name) <> ''),
  role_code text not null references public.roles(code)
);

alter table public.preassigned_user_roles enable row level security;
revoke all on public.preassigned_user_roles from public, anon, authenticated;

create function public.provision_verified_user_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role_code text;
  v_role_id uuid;
begin
  if new.last_sign_in_at is null or new.email_confirmed_at is null
     or nullif(btrim(new.email), '') is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.last_sign_in_at is not null and old.email_confirmed_at is not null then
    return new;
  end if;

  delete from public.preassigned_user_roles
  where email = lower(btrim(new.email))
  returning role_code into v_role_code;

  if exists (select 1 from public.user_roles where user_id = new.id) then
    return new;
  end if;

  select id into strict v_role_id from public.roles
  where code = coalesce(v_role_code, 'STUDENT');

  insert into public.user_roles (user_id, role_id)
  values (new.id, v_role_id)
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.provision_verified_user_role() from public, anon, authenticated;

-- On INSERT, this trigger runs after on_auth_user_created creates the profile.
create trigger provision_verified_user_role
after insert or update of email_confirmed_at, last_sign_in_at on auth.users
for each row execute function public.provision_verified_user_role();

create function public.get_admin_user_directory_v3()
returns table(user_id uuid, first_name text, last_name text, full_name text, email text,
  account_status public.account_status, role_codes text[], role_names text[],
  pending_registration boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '28000';
  end if;
  if not public.has_role('ADMIN') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  with accounts as materialized (
    select * from public.get_admin_user_directory_v2()
  ), pending as (
    select p.id, p.full_name, p.email, r.code, r.name
    from public.preassigned_user_roles p
    join public.roles r on r.code = p.role_code
    where not exists (
      select 1 from accounts a
      where lower(btrim(a.email)) = p.email and cardinality(a.role_codes) > 0
    )
  )
  select d.* from (
    select a.*, false as pending_registration from accounts a
    where not exists (
      select 1 from pending p where p.email = lower(btrim(a.email))
    )
    union all
    select p.id, null::text, null::text, p.full_name, p.email,
      null::public.account_status, array[p.code], array[p.name], true
    from pending p
  ) d
  order by lower(d.full_name), lower(d.email);
end;
$$;
revoke all on function public.get_admin_user_directory_v3() from public, anon, authenticated;
grant execute on function public.get_admin_user_directory_v3() to authenticated;
