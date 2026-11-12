-- Authorized, real-data source for the consolidated staff usage dashboard.
alter table public.room_types
 add column if not exists report_category text
 check (report_category in ('MEETING','GENERAL_LAB','SPECIAL_LAB'));

update public.room_types
set report_category=case
 when code='MEETING' then 'MEETING'
 when code='COMPUTER' then 'GENERAL_LAB'
 when code in ('STUDIO','GAMING','ELEARNING','COLD') then 'SPECIAL_LAB'
 else report_category
end
where report_category is null;

create or replace function public.get_staff_usage_history()
returns table(
 transaction_id text, source text, room_id uuid, room_code text, room_name text,
 room_category text, purpose text, user_name text, starts_at timestamptz,
 ends_at timestamptz, returned_at timestamptz, status text
) language plpgsql stable security definer set search_path='' as $$
begin
 if not (public.has_permission('REPORT_READ') or public.has_permission('ROOM_MANAGE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 return query
 with usage_rows as (
  select 'booking:'||b.id::text transaction_id,'BOOKING'::text source,r.id room_id,r.code room_code,r.name room_name,
   rt.report_category room_category,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ') user_name,
   b.starts_at,b.ends_at,null::timestamptz returned_at,b.status::text status
  from public.bookings b join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id
  left join public.profiles p on p.id=b.requester_id
  where rt.report_category='MEETING' and b.status in ('APPROVED','IN_USE','COMPLETED')
  union all
  select 'key-request:'||k.id::text,'KEY_REQUEST',r.id,r.code,r.name,rt.report_category,k.purpose,
   coalesce(nullif(k.requester_name,''),p.full_name,k.requester_email,'ไม่ระบุ'),k.starts_at,k.ends_at,k.returned_at,k.status
  from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id
  left join public.profiles p on p.id=k.authenticated_user_id
  where rt.report_category in ('GENERAL_LAB','SPECIAL_LAB') and k.status in ('APPROVED','IN_USE','RETURNED')
  union all
  select 'key-loan:'||kl.id::text,'KEY_LOAN',r.id,r.code,r.name,rt.report_category,b.purpose,
   coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),coalesce(kl.checked_out_at,b.starts_at),b.ends_at,kl.returned_at,kl.status::text
  from public.key_loans kl join public.bookings b on b.id=kl.booking_id join public.rooms r on r.id=b.room_id
  join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=kl.borrower_id
  where rt.report_category in ('GENERAL_LAB','SPECIAL_LAB') and kl.status in ('CHECKED_OUT','RETURNED','LATE','LOST','DAMAGED')
 )
 select u.transaction_id,u.source,u.room_id,u.room_code,u.room_name,u.room_category,u.purpose,u.user_name,
  u.starts_at,u.ends_at,u.returned_at,u.status from usage_rows u order by u.starts_at desc,u.transaction_id;
end $$;

revoke all on function public.get_staff_usage_history() from public,anon,authenticated;
grant execute on function public.get_staff_usage_history() to authenticated;

comment on column public.room_types.report_category is 'Explicit category used by authorized usage reports; null excludes the type from those reports.';
comment on function public.get_staff_usage_history() is 'Returns canonical real usage records for authorized staff reporting without cancelled or rejected requests.';
