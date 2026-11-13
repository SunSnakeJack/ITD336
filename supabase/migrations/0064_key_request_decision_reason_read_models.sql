-- Expose staff decision status/reason through controlled read models.
drop function if exists public.get_admin_key_request_queue();
create function public.get_admin_key_request_queue()
returns table(id uuid,request_code text,room_code text,room_name text,requester_name text,requester_email text,purpose text,starts_at timestamptz,ends_at timestamptz,status text,submitted_at timestamptz,decision_reason text)
language plpgsql security definer set search_path='' stable as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_APPROVE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select k.id,k.request_code,r.code,r.name,k.requester_name,k.requester_email,k.purpose,k.starts_at,k.ends_at,k.status,k.submitted_at,k.decision_reason
 from public.key_requests k join public.rooms r on r.id=k.room_id order by case when k.status='PENDING_APPROVAL' then 0 else 1 end,k.submitted_at desc;
end $$;

create function public.get_my_key_requests_v2()
returns table(id uuid,request_code text,room_code text,room_name text,room_type_name text,floor text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text,decision_reason text,can_cancel boolean,can_return boolean)
language plpgsql security definer set search_path='' stable as $$
declare v_email text;
begin
 select lower(u.email) into v_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if v_email is null then return;end if;
 return query select k.id,k.request_code,r.code,r.name,rt.name,r.floor,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,k.status,k.decision_reason,
  (k.status in('PENDING_APPROVAL','APPROVED') and k.ends_at>now()),(k.status in('APPROVED','IN_USE') and now()>=k.starts_at)
 from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id
 where k.authenticated_user_id=auth.uid() or (k.authenticated_user_id is null and lower(k.requester_email)=v_email) order by k.created_at desc;
end $$;

revoke all on function public.get_admin_key_request_queue() from public,anon,authenticated;
revoke all on function public.get_my_key_requests_v2() from public,anon,authenticated;
grant execute on function public.get_admin_key_request_queue() to authenticated;
grant execute on function public.get_my_key_requests_v2() to authenticated;

-- Keep decision rows visible in the dashboard so staff can act without changing pages.
create or replace function public.get_staff_usage_history()
returns table(transaction_id text,source text,room_id uuid,room_code text,room_name text,room_category text,purpose text,user_name text,starts_at timestamptz,ends_at timestamptz,returned_at timestamptz,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not(public.has_permission('REPORT_READ') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query with usage_rows as (
  select 'booking:'||b.id::text,'BOOKING'::text,r.id,r.code,r.name,rt.report_category,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),b.starts_at,b.ends_at,null::timestamptz,b.status::text
  from public.bookings b join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=b.requester_id where rt.report_category='MEETING' and b.status in('APPROVED','IN_USE','COMPLETED')
  union all
  select 'key-request:'||k.id::text,'KEY_REQUEST',r.id,r.code,r.name,rt.report_category,case when k.status='REJECTED' then coalesce(k.decision_reason,k.purpose) else k.purpose end,coalesce(nullif(k.requester_name,''),p.full_name,k.requester_email,'ไม่ระบุ'),k.starts_at,k.ends_at,k.returned_at,k.status
  from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=k.authenticated_user_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and k.status in('PENDING_APPROVAL','APPROVED','REJECTED','IN_USE','RETURNED')
  union all
  select 'key-loan:'||kl.id::text,'KEY_LOAN',r.id,r.code,r.name,rt.report_category,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),coalesce(kl.checked_out_at,b.starts_at),b.ends_at,kl.returned_at,kl.status::text
  from public.key_loans kl join public.bookings b on b.id=kl.booking_id join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=kl.borrower_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and kl.status in('CHECKED_OUT','RETURNED','LATE','LOST','DAMAGED')
 ) select * from usage_rows order by starts_at desc,transaction_id;
end $$;
