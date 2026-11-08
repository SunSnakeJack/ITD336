drop function if exists public.get_my_key_requests();

create function public.get_my_key_requests()
returns table(id uuid,request_code text,room_code text,room_name text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text,can_cancel boolean)
language plpgsql security definer set search_path='' stable as $$
declare v_email text;
begin
 select lower(u.email) into v_email
 from auth.users u
 where u.id=auth.uid() and u.email_confirmed_at is not null;
 if v_email is null then return;end if;
 return query
 select k.id,k.request_code,r.code,r.name,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,k.status,
  k.authenticated_user_id=auth.uid() as can_cancel
 from public.key_requests k join public.rooms r on r.id=k.room_id
 where k.authenticated_user_id=auth.uid()
  or (k.authenticated_user_id is null and lower(k.requester_email)=lower(v_email))
 order by k.created_at desc;
end $$;

revoke all on function public.get_my_key_requests() from public;
grant execute on function public.get_my_key_requests() to authenticated;
