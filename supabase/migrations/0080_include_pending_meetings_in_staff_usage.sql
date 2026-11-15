create or replace function public.get_staff_usage_history()
returns table(transaction_id text,source text,room_id uuid,room_code text,room_name text,room_category text,purpose text,user_name text,starts_at timestamptz,ends_at timestamptz,returned_at timestamptz,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not(public.has_permission('REPORT_READ') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query with usage_rows(
  transaction_id,source,room_id,room_code,room_name,room_category,purpose,user_name,starts_at,ends_at,returned_at,status
 ) as (
  select 'booking:'||b.id::text,'BOOKING'::text,r.id,r.code,r.name,'MEETING'::text,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),b.starts_at,b.ends_at,null::timestamptz,b.status::text
  from public.bookings b join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=b.requester_id where rt.usage_scope='MEETING' and b.status in('PENDING','APPROVED','IN_USE','COMPLETED')
  union all
  select 'key-request:'||k.id::text,'KEY_REQUEST',r.id,r.code,r.name,rt.report_category,case when k.status='REJECTED' then coalesce(k.decision_reason,k.purpose) else k.purpose end,coalesce(nullif(k.requester_name,''),p.full_name,k.requester_email,'ไม่ระบุ'),k.starts_at,k.ends_at,k.returned_at,k.status
  from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=k.authenticated_user_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and k.status in('PENDING_APPROVAL','APPROVED','REJECTED','IN_USE','RETURNED')
  union all
  select 'key-loan:'||kl.id::text,'KEY_LOAN',r.id,r.code,r.name,rt.report_category,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),coalesce(kl.checked_out_at,b.starts_at),b.ends_at,kl.returned_at,kl.status::text
  from public.key_loans kl join public.bookings b on b.id=kl.booking_id join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=kl.borrower_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and kl.status in('CHECKED_OUT','RETURNED','LATE','LOST','DAMAGED')
 ) select u.* from usage_rows u order by u.starts_at desc,u.transaction_id;
end $$;
