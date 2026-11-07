-- Align the public key-request entry with the approved mobile workflow.
-- This migration is additive and must be runtime-tested before any cloud push.

drop function if exists public.get_public_room_catalog();
create function public.get_public_room_catalog()
returns table(
  id uuid, code text, layout_key text, name text, room_type_name text,
  building text, floor text, capacity integer, active boolean,
  academic_schedule_confirmed boolean, usage_scope text,
  requires_sso_for_key_request boolean
)
language sql stable security definer set search_path = '' as $$
  select r.id,r.code,r.layout_key,r.name,rt.name,r.building,r.floor,r.capacity,
    r.active,r.academic_schedule_confirmed,rt.usage_scope,rt.requires_sso_for_key_request
  from public.rooms r
  join public.room_types rt on rt.id = r.room_type_id
  left join public.room_usage_policies p on p.room_id = r.id
  where case
    when auth.uid() is null then coalesce(p.guest_view_details,true)
    when public.has_role('STUDENT') then coalesce(p.student_view_details,true)
    else true
  end
  order by r.code
$$;

revoke all on function public.get_public_room_catalog() from public;
grant execute on function public.get_public_room_catalog() to anon,authenticated;

create or replace function public.enforce_key_request_entry_rules()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.requester_email := lower(btrim(new.requester_email));
  if new.requester_email !~ '^[^@[:space:]]+@northbkk[.]ac[.]th$' then
    raise exception 'UNIVERSITY_EMAIL_REQUIRED' using errcode = '22023';
  end if;
  if extract(dow from new.starts_at at time zone 'Asia/Bangkok') = 6
     or extract(dow from new.ends_at at time zone 'Asia/Bangkok') = 6 then
    raise exception 'SATURDAY_NOT_AVAILABLE' using errcode = '22023';
  end if;
  if (new.starts_at at time zone 'Asia/Bangkok')::time < time '08:00'
     or (new.ends_at at time zone 'Asia/Bangkok')::time > time '18:00' then
    raise exception 'OUTSIDE_SERVICE_HOURS' using errcode = '22023';
  end if;
  return new;
end
$$;

drop trigger if exists enforce_key_request_entry_rules on public.key_requests;
create trigger enforce_key_request_entry_rules
before insert or update of requester_email,starts_at,ends_at on public.key_requests
for each row execute function public.enforce_key_request_entry_rules();
