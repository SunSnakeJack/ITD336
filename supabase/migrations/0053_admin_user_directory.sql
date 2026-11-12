-- Read-only user directory for the staff console. Role changes remain out of scope.
create or replace function public.get_admin_user_directory()
returns table(user_id uuid,full_name text,email text,account_status public.account_status,role_codes text[],role_names text[])
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not public.has_role('ADMIN') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform public.write_audit(v_actor,'ADMIN_USER_DIRECTORY_VIEWED','profile',v_actor,'{}'::jsonb);
 return query select p.id,p.full_name,p.email,p.account_status,
  coalesce(array_agg(r.code order by r.code) filter(where r.code is not null),'{}'::text[]),
  coalesce(array_agg(r.name order by r.code) filter(where r.name is not null),'{}'::text[])
 from public.profiles p left join public.user_roles ur on ur.user_id=p.id left join public.roles r on r.id=ur.role_id
 group by p.id,p.full_name,p.email,p.account_status order by lower(p.full_name),lower(p.email);
end $$;
revoke all on function public.get_admin_user_directory() from public,anon,authenticated;
grant execute on function public.get_admin_user_directory() to authenticated;
