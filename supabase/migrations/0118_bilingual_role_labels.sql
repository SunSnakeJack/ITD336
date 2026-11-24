alter table public.roles add column name_th text
 check (name_th is null or (name_th=btrim(name_th) and char_length(name_th) between 1 and 80));

update public.roles r set name_th = labels.name_th
from (values ('ADMIN','ผู้ดูแลระบบ'), ('DEAN','คณบดี'), ('DEPARTMENT_HEAD','หัวหน้าสาขา'),
 ('STAFF','เจ้าหน้าที่'), ('STUDENT','นักศึกษา'), ('TEACHER','อาจารย์'), ('PRIORITY_USER','คณบดีและหัวหน้าสาขา')) labels(code,name_th)
where r.code=labels.code;

create function public.get_admin_role_catalog_v2()
returns table(code text, name text, name_th text, locked boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not coalesce(public.has_role('ADMIN'), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query select r.code, r.name, r.name_th,
    r.system_role or r.code in ('ADMIN','DEAN','DEPARTMENT_HEAD','STAFF','STUDENT','TEACHER','PRIORITY_USER')
    or exists (select 1 from public.role_permissions rp where rp.role_id = r.id)
    from public.roles r where r.code <> 'PRIORITY_USER' order by 4 desc, r.name, r.code;
end
$$;

create function public.manage_admin_role_label_v2(p_operation text, p_code text, p_name text, p_name_th text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(p_code));
  v_name text := btrim(p_name);
  v_name_th text := nullif(btrim(p_name_th), '');
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
  if p_operation <> 'DELETE' and (v_name_th is null or char_length(v_name_th) > 80) then
    raise exception 'INVALID_ROLE_LABEL' using errcode = '22023';
  end if;
  if p_operation <> 'RENAME' and v_code in ('ADMIN','DEAN','DEPARTMENT_HEAD','STAFF','STUDENT','TEACHER','PRIORITY_USER') then
    raise exception 'SYSTEM_ROLE_LOCKED' using errcode = '23514';
  end if;

  if p_operation = 'CREATE' then
    insert into public.roles(code, name, name_th) values (v_code, v_name, v_name_th) returning * into v_role;
  else
    select * into v_role from public.roles r where r.code = v_code for update;
    if not found then raise exception 'ROLE_NOT_FOUND' using errcode = 'P0002'; end if;
    if p_operation = 'DELETE' and (v_role.system_role or exists (select 1 from public.role_permissions rp where rp.role_id = v_role.id)) then
      raise exception 'SYSTEM_ROLE_LOCKED' using errcode = '23514';
    end if;
    if p_operation = 'RENAME' then
      update public.roles set name = v_name, name_th = v_name_th where id = v_role.id returning * into v_role;
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
    jsonb_build_object('role_code', v_role.code, 'name', v_role.name, 'name_th', v_role.name_th));
end
$$;

revoke all on function public.get_admin_role_catalog_v2(),public.manage_admin_role_label_v2(text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.get_admin_role_catalog_v2(),public.manage_admin_role_label_v2(text,text,text,text)
 to authenticated;
