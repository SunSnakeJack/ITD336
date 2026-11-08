create or replace function public.get_my_key_requests()
returns table(id uuid,request_code text,room_code text,room_name text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text)
language sql security definer set search_path='' stable as $$
 select k.id,k.request_code,r.code,r.name,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,k.status
 from public.key_requests k join public.rooms r on r.id=k.room_id
 where auth.uid() is not null and k.authenticated_user_id=auth.uid()
 order by k.created_at desc
$$;

create or replace function public.cancel_my_key_request(p_key_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_request public.key_requests;begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 select * into v_request from public.key_requests where id=p_key_request_id and authenticated_user_id=v_actor for update;
 if not found then raise exception 'KEY_REQUEST_NOT_FOUND' using errcode='42501';end if;
 if v_request.status not in('PENDING_APPROVAL','APPROVED') then raise exception 'KEY_REQUEST_CANNOT_CANCEL';end if;
 update public.key_requests set status='CANCELLED',cancelled_at=now() where id=v_request.id;
 perform public.write_audit(v_actor,'KEY_REQUEST_CANCELLED','key_request',v_request.id,jsonb_build_object('source','SELF_SERVICE'));
 return jsonb_build_object('id',v_request.id,'status','CANCELLED');
end $$;

revoke all on function public.get_my_key_requests() from public;
revoke all on function public.cancel_my_key_request(uuid) from public;
grant execute on function public.get_my_key_requests() to authenticated;
grant execute on function public.cancel_my_key_request(uuid) to authenticated;
