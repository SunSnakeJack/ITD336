create function public.update_admin_preassigned_user(
  p_preassignment_id uuid, p_full_name text, p_role_codes text[]
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_name text := btrim(p_full_name);
  v_roles text[];
begin
  if v_actor is null or not public.has_role('ADMIN') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(v_name, '') is null then
    raise exception 'INVALID_USER_DETAILS' using errcode = '22023';
  end if;

  select array_agg(distinct upper(btrim(code)) order by upper(btrim(code)))
  into v_roles from unnest(p_role_codes) as codes(code);
  if v_roles is null or exists (
    select 1 from unnest(v_roles) as codes(code)
    where code is null or code = 'PRIORITY_USER'
      or not exists (select 1 from public.roles r where r.code = codes.code)
  ) then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;

  select email into v_email from public.preassigned_user_roles where id = p_preassignment_id;
  if v_email is not null then
    -- Serialize edits with first-login provisioning for this email.
    perform pg_advisory_xact_lock(336, hashtext(v_email));
    update public.preassigned_user_roles
    set full_name = v_name, role_code = v_roles[1]
    where id = p_preassignment_id;
  end if;
  if v_email is null or not found then
    raise exception 'PREASSIGNMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from public.preassigned_user_additional_roles where preassignment_id = p_preassignment_id;
  insert into public.preassigned_user_additional_roles(preassignment_id, role_code)
  select p_preassignment_id, code from unnest(v_roles) as codes(code) where code <> v_roles[1];

  perform public.write_audit(v_actor, 'USER_PREASSIGNMENT_UPDATED', 'preassigned_user_role',
    p_preassignment_id, jsonb_build_object('role_codes', v_roles));
end;
$$;
revoke all on function public.update_admin_preassigned_user(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.update_admin_preassigned_user(uuid, text, text[]) to authenticated;
