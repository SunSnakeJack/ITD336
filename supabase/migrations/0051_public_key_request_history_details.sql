-- Show requester role prefix, name, and purpose for key-request history in public room detail.
create or replace function public.get_public_key_request_history(p_room_id uuid,p_limit integer default 10)
returns table(id uuid,requester_name text,starts_at timestamptz,ends_at timestamptz,status text)
language sql security definer set search_path='' stable as $$
 select r.id,
  (case r.requester_type when 'TEACHER' then 'อ. ' when 'STUDENT' then 'นศ. ' else '' end)||r.requester_name||case when nullif(trim(r.purpose),'') is not null then ' · '||trim(r.purpose) else '' end as requester_name,
  r.starts_at,r.ends_at,r.status
 from public.key_requests r
 where r.room_id=p_room_id
  and r.status in('PENDING_APPROVAL','APPROVED','IN_USE','RETURNED')
  and (r.starts_at at time zone 'Asia/Bangkok')::date<=(now() at time zone 'Asia/Bangkok')::date
 order by r.starts_at desc limit least(greatest(coalesce(p_limit,10),1),10)
$$;

revoke all on function public.get_public_key_request_history(uuid,integer) from public;
grant execute on function public.get_public_key_request_history(uuid,integer) to anon,authenticated;
