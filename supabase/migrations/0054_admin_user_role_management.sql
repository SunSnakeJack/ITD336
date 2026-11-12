-- Admin-only role discovery and transactional role assignment.
create or replace function public.get_admin_role_options()
returns table(code text,name text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not public.has_role('ADMIN') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select r.code,r.name from public.roles r order by r.name;
end $$;

create or replace function public.set_admin_user_roles(p_user_id uuid,p_role_codes text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_codes text[];v_old_codes text[];
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not public.has_role('ADMIN') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if not exists(select 1 from public.profiles p where p.id=p_user_id) then raise exception 'USER_NOT_FOUND';end if;

 select coalesce(array_agg(distinct upper(btrim(code)) order by upper(btrim(code))),'{}'::text[]) into v_codes
 from unnest(coalesce(p_role_codes,'{}'::text[])) code where nullif(btrim(code),'') is not null;
 if exists(select 1 from unnest(v_codes) code where not exists(select 1 from public.roles r where r.code=code)) then
  raise exception 'INVALID_ROLE';
 end if;
 select coalesce(array_agg(r.code order by r.code),'{}'::text[]) into v_old_codes
 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p_user_id;

 if 'ADMIN'=any(v_old_codes) and not('ADMIN'=any(v_codes)) and
  (select count(distinct ur.user_id) from public.user_roles ur join public.roles r on r.id=ur.role_id where r.code='ADMIN')<=1 then
  raise exception 'LAST_ADMIN_REQUIRED' using errcode='23514';
 end if;

 delete from public.user_roles where user_id=p_user_id;
 insert into public.user_roles(user_id,role_id,assigned_by)
 select p_user_id,r.id,v_actor from public.roles r where r.code=any(v_codes);
 perform public.write_audit(v_actor,'USER_ROLES_UPDATED','profile',p_user_id,jsonb_build_object('previous_roles',v_old_codes,'new_roles',v_codes));
 return jsonb_build_object('user_id',p_user_id,'role_codes',v_codes);
end $$;

revoke all on function public.get_admin_role_options(),public.set_admin_user_roles(uuid,text[]) from public,anon,authenticated;
grant execute on function public.get_admin_role_options(),public.set_admin_user_roles(uuid,text[]) to authenticated;
