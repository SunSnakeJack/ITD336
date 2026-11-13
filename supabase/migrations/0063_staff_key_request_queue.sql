create or replace function public.get_admin_key_request_queue()
returns table(id uuid,request_code text,room_code text,room_name text,requester_name text,requester_email text,purpose text,starts_at timestamptz,ends_at timestamptz,status text,submitted_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_APPROVE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select k.id,k.request_code,r.code,r.name,k.requester_name,k.requester_email,k.purpose,k.starts_at,k.ends_at,k.status,k.submitted_at
 from public.key_requests k join public.rooms r on r.id=k.room_id
 where k.status in('PENDING_APPROVAL','APPROVED','IN_USE') order by case when k.status='PENDING_APPROVAL' then 0 else 1 end,k.starts_at;
end $$;
revoke all on function public.get_admin_key_request_queue() from public,anon,authenticated;
grant execute on function public.get_admin_key_request_queue() to authenticated;
