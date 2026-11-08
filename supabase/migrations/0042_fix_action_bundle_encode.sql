create or replace function public.issue_key_request_action_bundle(p_key_request_id uuid,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_track text;v_cancel text;v_return text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_expires_at<=now() then raise exception 'TOKEN_ALREADY_EXPIRED';end if;
 if not exists(select 1 from public.key_requests where id=p_key_request_id) then raise exception 'KEY_REQUEST_NOT_FOUND';end if;
 v_track:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 v_cancel:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 v_return:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 insert into public.secure_action_tokens(key_request_id,action,token_digest,expires_at) values
  (p_key_request_id,'TRACK',extensions.digest(pg_catalog.convert_to(v_track,'UTF8'),'sha256'),p_expires_at),
  (p_key_request_id,'CANCEL',extensions.digest(pg_catalog.convert_to(v_cancel,'UTF8'),'sha256'),p_expires_at),
  (p_key_request_id,'RETURN',extensions.digest(pg_catalog.convert_to(v_return,'UTF8'),'sha256'),p_expires_at);
 return jsonb_build_object('track_token',v_track,'cancel_token',v_cancel,'return_token',v_return,'expires_at',p_expires_at);
end $$;

revoke all on function public.issue_key_request_action_bundle(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.issue_key_request_action_bundle(uuid,timestamptz) to service_role;
