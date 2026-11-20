create table public.preassigned_user_additional_roles (
  preassignment_id uuid not null references public.preassigned_user_roles(id) on delete cascade,
  role_code text not null references public.roles(code),
  primary key (preassignment_id, role_code)
);
alter table public.preassigned_user_additional_roles enable row level security;
revoke all on public.preassigned_user_additional_roles from public, anon, authenticated;

create function public.add_admin_preassigned_user(p_email text, p_full_name text, p_role_codes text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_name text := btrim(p_full_name);
  v_roles text[];
  v_id uuid;
begin
  if v_actor is null or not public.has_role('ADMIN') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or nullif(v_name, '') is null then
    raise exception 'INVALID_USER_DETAILS' using errcode = '22023';
  end if;
  select array_agg(distinct upper(btrim(code)) order by upper(btrim(code)))
  into v_roles from unnest(p_role_codes) as codes(code);
  v_roles := coalesce(v_roles, array['STUDENT']::text[]);
  if exists (
    select 1 from unnest(v_roles) as codes(code)
    where code is null or code = 'PRIORITY_USER'
      or not exists (select 1 from public.roles r where r.code = codes.code)
  ) then raise exception 'INVALID_ROLE' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(336, hashtext(v_email));
  if exists (select 1 from auth.users u where lower(btrim(u.email)) = v_email) then
    raise exception 'EMAIL_ALREADY_REGISTERED' using errcode = '23505';
  end if;
  insert into public.preassigned_user_roles(email, full_name, role_code)
  values (v_email, v_name, v_roles[1])
  on conflict (email) do nothing returning id into v_id;
  if v_id is null then raise exception 'EMAIL_ALREADY_PREASSIGNED' using errcode = '23505'; end if;

  insert into public.preassigned_user_additional_roles(preassignment_id, role_code)
  select v_id, code from unnest(v_roles) as codes(code) where code <> v_roles[1];
  perform public.write_audit(v_actor, 'USER_PREASSIGNED', 'preassigned_user_role', v_id,
    jsonb_build_object('role_codes', v_roles));
  return v_id;
end;
$$;
revoke all on function public.add_admin_preassigned_user(text, text, text[]) from public, anon, authenticated;
grant execute on function public.add_admin_preassigned_user(text, text, text[]) to authenticated;

create or replace function public.provision_verified_user_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(new.email));
  v_assignment public.preassigned_user_roles;
begin
  if new.last_sign_in_at is null or new.email_confirmed_at is null or nullif(v_email, '') is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.last_sign_in_at is not null and old.email_confirmed_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(336, hashtext(v_email));
  select * into v_assignment from public.preassigned_user_roles
  where email = v_email for update;

  if not exists (select 1 from public.user_roles where user_id = new.id) then
    insert into public.user_roles (user_id, role_id)
    select new.id, r.id from public.roles r
    where r.code = coalesce(v_assignment.role_code, 'STUDENT')
      or exists (
        select 1 from public.preassigned_user_additional_roles a
        where a.preassignment_id = v_assignment.id and a.role_code = r.code
      )
    on conflict do nothing;
  end if;
  delete from public.preassigned_user_roles where id = v_assignment.id;
  return new;
end;
$$;

create or replace function public.get_admin_user_directory_v3()
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
    select a.* from public.get_admin_user_directory_v2() a
    join public.profiles p on p.id = a.user_id
    where p.deleted_at is null
  ), pending as (
    select p.id, p.full_name, p.email, assigned.codes, assigned.names
    from public.preassigned_user_roles p
    cross join lateral (
      select array_agg(r.code order by r.code) as codes, array_agg(r.name order by r.code) as names
      from public.roles r
      where r.code = p.role_code or exists (
        select 1 from public.preassigned_user_additional_roles a
        where a.preassignment_id = p.id and a.role_code = r.code
      )
    ) assigned
    where not exists (
      select 1 from accounts a
      where lower(btrim(a.email)) = p.email and cardinality(a.role_codes) > 0
    )
  )
  select d.* from (
    select a.*, false as pending_registration from accounts a
    where not exists (select 1 from pending p where p.email = lower(btrim(a.email)))
    union all
    select p.id, null::text, null::text, p.full_name, p.email,
      null::public.account_status, p.codes, p.names, true
    from pending p
  ) d
  order by lower(d.full_name), lower(d.email);
end;
$$;
