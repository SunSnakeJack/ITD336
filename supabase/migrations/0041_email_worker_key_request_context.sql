create or replace function public.get_key_request_email_context(p_key_request_id uuid)
returns table(request_code text,status text,starts_at timestamptz,ends_at timestamptz,purpose text,decision_reason text,room_name text)
language plpgsql security definer set search_path='' stable as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query
 select k.request_code,k.status,k.starts_at,k.ends_at,k.purpose,k.decision_reason,r.name
 from public.key_requests k join public.rooms r on r.id=k.room_id
 where k.id=p_key_request_id;
end $$;

revoke all on function public.get_key_request_email_context(uuid) from public,anon,authenticated;
grant execute on function public.get_key_request_email_context(uuid) to service_role;
