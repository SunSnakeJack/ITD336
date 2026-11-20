alter table public.audit_logs
  add column actor_kind text check (actor_kind in ('ADMIN', 'USER', 'SYSTEM')),
  add column actor_name text,
  add column ip_address inet;

create function public.capture_audit_actor() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.actor_kind := case
    when new.actor_id is null and (new.metadata->>'anonymous' = 'true' or new.action in ('KEY_REQUEST_TOKEN_CANCEL', 'KEY_REQUEST_TOKEN_RETURN')) then 'USER'
    when new.actor_id is null then 'SYSTEM'
    when new.action = 'USER_ROLES_UPDATED' and new.actor_id = new.entity_id
      and (new.metadata->'previous_roles') ? 'ADMIN' then 'ADMIN'
    when exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = new.actor_id and r.code = 'ADMIN'
    ) then 'ADMIN'
    else 'USER'
  end;
  select nullif(btrim(p.full_name), '') into new.actor_name
  from public.profiles p where p.id = new.actor_id;
  return new;
end
$$;
revoke all on function public.capture_audit_actor() from public, anon, authenticated;
create trigger capture_audit_actor before insert on public.audit_logs
for each row execute function public.capture_audit_actor();

create index audit_logs_recent_idx on public.audit_logs(created_at desc, id desc);

create function public.get_staff_audit_logs(p_actor text, p_actions text[], p_page integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.has_permission('AUDIT_READ'), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if (p_actor is not null and p_actor not in ('ADMIN','USER'))
    or p_page is null or p_page < 1 or coalesce(cardinality(p_actions), 0) > 50 then
    raise exception 'INVALID_FILTER' using errcode = '22023';
  end if;

  return (
    with matching as (
      select l.* from public.audit_logs l
      where (p_actor is null or l.actor_kind = p_actor)
        and (p_actions is null or l.action = any(p_actions))
    ), page_rows as (
      select * from matching order by created_at desc, id desc
      limit 10 offset (p_page::bigint - 1) * 10
    )
    select jsonb_build_object('total', (select count(*) from matching), 'rows',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id::text,
        'createdAt', l.created_at,
        'actorName', coalesce(l.actor_name, nullif(btrim(p.full_name), '')),
        'actorKind', l.actor_kind,
        'action', l.action,
        'entityType', l.entity_type,
        'entityId', l.entity_id,
        'reference', coalesce(k.request_code, b.booking_code, r.code, target.full_name,
          left(l.metadata->>'role_code', 40)),
        'detail', left(coalesce(
          nullif(l.metadata->>'reason', ''),
          case when l.action = 'ADMIN_USER_PROFILE_UPDATED' then
            nullif(concat_ws(' ', l.metadata->>'first_name', l.metadata->>'last_name'), '') end,
          case when l.action = 'USER_ROLES_UPDATED' and jsonb_typeof(l.metadata->'new_roles') = 'array'
            then l.metadata->>'new_roles' end,
          l.metadata->>'status', l.metadata->>'name', l.metadata->>'source'
        ), 300),
        'ip', host(l.ip_address)
      ) order by l.created_at desc, l.id desc)
      from page_rows l
      left join public.profiles p on p.id = l.actor_id
      left join public.profiles target on l.entity_type = 'profile' and target.id = l.entity_id
      left join public.key_requests k on l.entity_type = 'key_request' and k.id = l.entity_id
      left join public.bookings b on l.entity_type = 'booking' and b.id = l.entity_id
      left join public.rooms r on l.entity_type = 'room' and r.id = l.entity_id), '[]'::jsonb))
  );
end
$$;
revoke all on function public.get_staff_audit_logs(text, text[], integer) from public, anon, authenticated;
grant execute on function public.get_staff_audit_logs(text, text[], integer) to authenticated;

create function public.get_admin_role_catalog()
returns table(code text, name text, locked boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.has_role('ADMIN'), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query select r.code, r.name,
    r.system_role or r.code in ('ADMIN','DEAN','DEPARTMENT_HEAD','STAFF','STUDENT','TEACHER','PRIORITY_USER')
    or exists (select 1 from public.role_permissions rp where rp.role_id = r.id)
    from public.roles r where r.code <> 'PRIORITY_USER' order by 3 desc, r.name, r.code;
end
$$;

create function public.manage_admin_role_label(p_operation text, p_code text, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(p_code));
  v_name text := btrim(p_name);
  v_role public.roles;
begin
  if v_actor is null or not coalesce(public.has_role('ADMIN'), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_operation is null or p_operation not in ('CREATE','RENAME','DELETE')
    or v_code is null or v_code !~ '^[A-Z][A-Z0-9_]{1,39}$'
    or (p_operation <> 'DELETE' and (v_name is null or char_length(v_name) not between 1 and 80)) then
    raise exception 'INVALID_ROLE_LABEL' using errcode = '22023';
  end if;
  if v_code in ('ADMIN','DEAN','DEPARTMENT_HEAD','STAFF','STUDENT','TEACHER','PRIORITY_USER') then
    raise exception 'SYSTEM_ROLE_LOCKED' using errcode = '23514';
  end if;

  if p_operation = 'CREATE' then
    insert into public.roles(code, name) values (v_code, v_name) returning * into v_role;
  else
    select * into v_role from public.roles r where r.code = v_code for update;
    if not found then raise exception 'ROLE_NOT_FOUND' using errcode = 'P0002'; end if;
    if v_role.system_role or exists (select 1 from public.role_permissions rp where rp.role_id = v_role.id) then
      raise exception 'SYSTEM_ROLE_LOCKED' using errcode = '23514';
    end if;
    if p_operation = 'RENAME' then
      update public.roles set name = v_name where id = v_role.id returning * into v_role;
    else
      if exists (select 1 from public.user_roles ur where ur.role_id = v_role.id)
        or exists (select 1 from public.preassigned_user_roles a where a.role_code = v_code)
        or exists (select 1 from public.preassigned_user_additional_roles a where a.role_code = v_code) then
        raise exception 'ROLE_IN_USE' using errcode = '23503';
      end if;
      delete from public.roles where id = v_role.id;
    end if;
  end if;
  perform public.write_audit(v_actor, 'ROLE_LABEL_' || p_operation, 'role', v_role.id,
    jsonb_build_object('role_code', v_role.code, 'name', v_role.name));
end
$$;
revoke all on function public.get_admin_role_catalog(), public.manage_admin_role_label(text,text,text)
from public, anon, authenticated;
grant execute on function public.get_admin_role_catalog(), public.manage_admin_role_label(text,text,text)
to authenticated;

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

    -- Labels alone keep the normal first-sign-in Student default.
    if not exists (
      select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
      where ur.user_id=new.id and r.code in ('ADMIN','DEAN','DEPARTMENT_HEAD','STAFF','STUDENT','TEACHER','PRIORITY_USER')
    ) then
      insert into public.user_roles(user_id, role_id)
      select new.id, r.id from public.roles r where r.code='STUDENT'
      on conflict do nothing;
    end if;
  end if;
  delete from public.preassigned_user_roles where id = v_assignment.id;
  return new;
end;
$$;
