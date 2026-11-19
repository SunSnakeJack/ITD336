alter table public.profiles
  add column deleted_at timestamptz,
  add constraint deleted_profile_is_inactive check (deleted_at is null or account_status = 'INACTIVE');

-- Keep the Auth ban in place if a stale admin screen tries to reactivate a deleted account.
create function public.prevent_deleted_user_unban() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.banned_until is not null
     and (new.banned_until is null or new.banned_until < old.banned_until)
     and exists (select 1 from public.profiles p where p.id = new.id and p.deleted_at is not null) then
    raise exception 'USER_DELETED' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_deleted_user_unban() from public, anon, authenticated;

create trigger prevent_deleted_user_unban before update of banned_until on auth.users
for each row execute function public.prevent_deleted_user_unban();

create function public.remove_admin_directory_user(p_user_id uuid, p_pending_registration boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not public.has_role('ADMIN') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id = v_actor then
    raise exception 'CANNOT_DELETE_SELF' using errcode = '22023';
  end if;

  if p_pending_registration then
    delete from public.preassigned_user_roles where id = p_user_id;
    if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
    perform public.write_audit(v_actor, 'USER_PREASSIGNMENT_REMOVED', 'preassigned_user_role', p_user_id);
    return;
  end if;

  -- Serialize removals and lock the Auth row before touching the profile.
  perform pg_advisory_xact_lock(336, 84);
  if not public.has_role('ADMIN') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  perform 1 from auth.users where id = p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;

  if exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id and r.code = 'ADMIN'
  ) and not exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where r.code = 'ADMIN' and p.account_status = 'ACTIVE' and p.id <> p_user_id
  ) then
    raise exception 'LAST_ADMIN_REQUIRED' using errcode = '23514';
  end if;

  update auth.users set banned_until = greatest(banned_until, now() + interval '100 years')
  where id = p_user_id;
  update public.profiles set account_status = 'INACTIVE', deleted_at = now(), updated_at = now()
  where id = p_user_id and deleted_at is null;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;

  delete from public.preassigned_user_roles
  where email = (select lower(btrim(email)) from auth.users where id = p_user_id);
  perform public.write_audit(v_actor, 'USER_REMOVED', 'profile', p_user_id);
end;
$$;
revoke all on function public.remove_admin_directory_user(uuid, boolean) from public, anon, authenticated;
grant execute on function public.remove_admin_directory_user(uuid, boolean) to authenticated;

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
