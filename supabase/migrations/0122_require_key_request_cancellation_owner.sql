create or replace function public.cancel_my_key_request(p_key_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_email text;v_request public.key_requests;begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 select lower(u.email) into v_email from auth.users u where u.id=v_actor and u.email_confirmed_at is not null;
 select * into v_request from public.key_requests where id=p_key_request_id for update;
 if not found or (v_request.authenticated_user_id=v_actor or (v_request.authenticated_user_id is null and v_email is not null and lower(v_request.requester_email)=lower(v_email))) is not true then raise exception 'KEY_REQUEST_NOT_FOUND' using errcode='42501';end if;
 if v_request.status not in('PENDING_APPROVAL','APPROVED') then raise exception 'KEY_REQUEST_CANNOT_CANCEL';end if;
 if v_request.ends_at<=now() then raise exception 'KEY_REQUEST_CANCELLATION_CLOSED';end if;
 update public.key_requests set status='CANCELLED',cancelled_at=now() where id=v_request.id;
 perform public.write_audit(v_actor,'KEY_REQUEST_CANCELLED','key_request',v_request.id,jsonb_build_object('source','SELF_SERVICE'));
 return jsonb_build_object('id',v_request.id,'status','CANCELLED');
end $$;
