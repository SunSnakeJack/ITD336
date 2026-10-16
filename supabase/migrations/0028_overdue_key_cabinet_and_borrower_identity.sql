-- Distinguish an active checkout from an overdue key and expose safe borrower identity to Admin.
create or replace view public.admin_key_activity_v with (security_invoker=true) as
select l.*,k.key_code,r.code room_code,r.name room_name,
 (l.status='RETURN_REPORTED' and l.expected_return_at is not null and l.user_reported_return_at>l.expected_return_at) returned_late,
 nullif(btrim(p.full_name),'') borrower_full_name,
 nullif(btrim(p.university_id),'') borrower_university_id,
 p.email borrower_email
from public.key_loans l
left join public.room_keys k on k.id=l.key_id
join public.rooms r on r.id=l.room_id
join public.profiles p on p.id=l.borrower_id;

grant select on public.admin_key_activity_v to authenticated;

create or replace function public.get_admin_key_cabinet()
returns table(room_id uuid,room_code text,room_name text,room_active boolean,key_status text,available_keys bigint,held_keys bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('ROOM_MANAGE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 return query
 select r.id,r.code,r.name,r.active,
  case
   when exists(
    select 1 from public.key_loans l
    where l.room_id=r.id and l.status in('CHECKED_OUT','LATE')
     and (l.status='LATE' or (l.expected_return_at is not null and l.expected_return_at<=now()))
   ) then 'OVERDUE'
   when not r.active then 'ROOM_CLOSED'
   when exists(
    select 1 from public.key_loans l
    where l.room_id=r.id and l.status in('CHECKED_OUT','LATE')
   ) then 'CHECKED_OUT'
   else 'AVAILABLE'
  end,
  count(k.id) filter(where k.active and k.status='AVAILABLE'),
  (select count(*) from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE'))
 from public.rooms r
 left join public.room_keys k on k.room_id=r.id
 group by r.id
 order by r.code;
end $$;

revoke all on function public.get_admin_key_cabinet() from public,anon;
grant execute on function public.get_admin_key_cabinet() to authenticated;
