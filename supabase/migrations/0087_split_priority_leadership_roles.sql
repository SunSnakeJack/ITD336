update public.roles
set name = case code when 'DEAN' then 'Dean' else 'Head of Department' end
where code in ('DEAN', 'DEPARTMENT_HEAD');

insert into public.role_permissions (role_id, permission_id)
select leadership.id, permission.permission_id
from public.roles priority
join public.role_permissions permission on permission.role_id = priority.id
cross join public.roles leadership
where priority.code = 'PRIORITY_USER'
  and leadership.code in ('DEAN', 'DEPARTMENT_HEAD')
on conflict do nothing;

-- Keep the priority policy checks shared across both new options and legacy holders.
create or replace function public.has_role(p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid() and p.account_status = 'ACTIVE'
      and (r.code = p_role
        or (p_role = 'PRIORITY_USER' and r.code in ('DEAN', 'DEPARTMENT_HEAD')))
  );
$$;
