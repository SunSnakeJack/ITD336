drop function if exists public.get_my_key_requests();

create function public.get_my_key_requests()
returns table(id uuid,request_code text,room_code text,room_name text,room_type_name text,floor text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text,can_cancel boolean)
language plpgsql security definer set search_path='' stable as $$
declare v_email text;
begin
 select lower(u.email) into v_email from auth.users u
 where u.id=auth.uid() and u.email_confirmed_at is not null;
 if v_email is null then return;end if;
 return query
 select k.id,k.request_code,r.code,r.name,rt.name,r.floor,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,k.status,
  (k.status in('PENDING_APPROVAL','APPROVED') and k.ends_at>now()) as can_cancel
 from public.key_requests k
 join public.rooms r on r.id=k.room_id
 join public.room_types rt on rt.id=r.room_type_id
 where k.authenticated_user_id=auth.uid()
  or (k.authenticated_user_id is null and lower(k.requester_email)=lower(v_email))
 order by k.created_at desc;
end $$;

create or replace function public.cancel_my_key_request(p_key_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_email text;v_request public.key_requests;begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 select lower(u.email) into v_email from auth.users u where u.id=v_actor and u.email_confirmed_at is not null;
 select * into v_request from public.key_requests where id=p_key_request_id for update;
 if not found or not(v_request.authenticated_user_id=v_actor or (v_request.authenticated_user_id is null and v_email is not null and lower(v_request.requester_email)=lower(v_email))) then raise exception 'KEY_REQUEST_NOT_FOUND' using errcode='42501';end if;
 if v_request.status not in('PENDING_APPROVAL','APPROVED') then raise exception 'KEY_REQUEST_CANNOT_CANCEL';end if;
 if v_request.ends_at<=now() then raise exception 'KEY_REQUEST_CANCELLATION_CLOSED';end if;
 update public.key_requests set status='CANCELLED',cancelled_at=now() where id=v_request.id;
 perform public.write_audit(v_actor,'KEY_REQUEST_CANCELLED','key_request',v_request.id,jsonb_build_object('source','SELF_SERVICE'));
 return jsonb_build_object('id',v_request.id,'status','CANCELLED');
end $$;

revoke all on function public.get_my_key_requests() from public;
revoke all on function public.cancel_my_key_request(uuid) from public;
grant execute on function public.get_my_key_requests() to authenticated;
grant execute on function public.cancel_my_key_request(uuid) to authenticated;
