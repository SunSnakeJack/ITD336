create or replace function public.get_admin_user_directory_v2()
returns table(user_id uuid, first_name text, last_name text, full_name text, email text, account_status public.account_status, role_codes text[], role_names text[])
language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
  if not public.has_role('ADMIN') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform public.write_audit(v_actor,'ADMIN_USER_DIRECTORY_VIEWED','profile',v_actor,'{}'::jsonb);
  return query select p.id,p.first_name,p.last_name,p.full_name,p.email,p.account_status,
    coalesce(array_agg(r.code order by r.code) filter(where r.code is not null),'{}'::text[]),
    coalesce(array_agg(r.name order by r.code) filter(where r.name is not null),'{}'::text[])
  from public.profiles p left join public.user_roles ur on ur.user_id=p.id left join public.roles r on r.id=ur.role_id
  group by p.id,p.first_name,p.last_name,p.full_name,p.email,p.account_status order by lower(p.full_name),lower(p.email);
end $$;

create or replace function public.update_admin_user_profile(p_user_id uuid,p_first_name text,p_last_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := auth.uid(); v_first text := trim(coalesce(p_first_name,'')); v_last text := trim(coalesce(p_last_name,''));
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
  if not public.has_role('ADMIN') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if v_first = '' then raise exception 'FIRST_NAME_REQUIRED' using errcode='22023'; end if;
  update public.profiles set first_name=v_first,last_name=nullif(v_last,''),full_name=trim(concat_ws(' ',v_first,nullif(v_last,''))),updated_at=now() where id=p_user_id;
  if not found then raise exception 'USER_NOT_FOUND' using errcode='P0002'; end if;
  perform public.write_audit(v_actor,'ADMIN_USER_PROFILE_UPDATED','profile',p_user_id,jsonb_build_object('first_name',v_first,'last_name',v_last));
end $$;

revoke all on function public.get_admin_user_directory_v2() from public,anon,authenticated;
revoke all on function public.update_admin_user_profile(uuid,text,text) from public,anon,authenticated;
grant execute on function public.get_admin_user_directory_v2() to authenticated;
grant execute on function public.update_admin_user_profile(uuid,text,text) to authenticated;
