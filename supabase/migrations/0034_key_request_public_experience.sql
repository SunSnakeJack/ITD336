-- Product-owner approved public key-request experience.
-- Public output is limited to requester name, time and status; identifiers and email remain private.
alter table public.key_requests
 add column requester_type text check(requester_type in('STUDENT','TEACHER')),
 add column requester_identifier text check(requester_identifier is null or length(btrim(requester_identifier)) between 1 and 50);

create table public.key_request_reference_options(
 id uuid primary key default gen_random_uuid(),course_code text not null,course_name text not null,
 lecturer_name text not null,lecturer_email text not null check(lower(lecturer_email)=lecturer_email and lecturer_email~'^[^@[:space:]]+@northbkk[.]ac[.]th$'),
 active boolean not null default true,unique(course_code,lecturer_email)
);
alter table public.key_request_reference_options enable row level security;

insert into public.key_request_reference_options(course_code,course_name,lecturer_name,lecturer_email) values
 ('ITD336','การพัฒนาเว็บแอปพลิเคชัน','อ. พสวัตน์','pasawat@northbkk.ac.th'),
 ('ITD463','โครงงานเทคโนโลยีสารสนเทศ','ผศ. กิตติชัย','kittichai@northbkk.ac.th')
on conflict(course_code,lecturer_email) do update set course_name=excluded.course_name,lecturer_name=excluded.lecturer_name,active=true;

create or replace function public.get_public_key_request_history(p_room_id uuid,p_limit integer default 10)
returns table(id uuid,requester_name text,starts_at timestamptz,ends_at timestamptz,status text)
language sql security definer set search_path='' stable as $$
 select r.id,r.requester_name,r.starts_at,r.ends_at,r.status from public.key_requests r
 where r.room_id=p_room_id and r.status in('APPROVED','IN_USE','RETURNED')
 order by r.starts_at desc limit least(greatest(coalesce(p_limit,10),1),10)
$$;

create or replace function public.get_public_key_request_options()
returns table(id uuid,course_code text,course_name text,lecturer_name text)
language sql security definer set search_path='' stable as $$
 select o.id,o.course_code,o.course_name,o.lecturer_name from public.key_request_reference_options o where o.active order by o.course_code
$$;

create or replace function public.create_key_request_v2(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_requester_type text,p_requester_identifier text,
 p_purpose_type text,p_purpose text,p_starts_at timestamptz,p_ends_at timestamptz,p_reference_option_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_id uuid;v_option public.key_request_reference_options;begin
 if p_requester_type not in('STUDENT','TEACHER') or nullif(btrim(p_requester_identifier),'') is null or length(btrim(p_requester_identifier))>50 then raise exception 'REQUESTER_IDENTITY_REQUIRED';end if;
 if p_purpose_type='TEACHING' then
  select * into v_option from public.key_request_reference_options where id=p_reference_option_id and active;
  if not found then raise exception 'REFERENCE_OPTION_REQUIRED';end if;
 end if;
 v_result:=public.create_key_request(p_room_id,p_requester_name,p_requester_email,p_purpose_type,p_purpose,p_starts_at,p_ends_at,
  v_option.course_code,v_option.course_name,v_option.lecturer_name,v_option.lecturer_email);
 v_id:=(v_result->>'id')::uuid;
 update public.key_requests set requester_type=p_requester_type,requester_identifier=btrim(p_requester_identifier) where id=v_id;
 return v_result;
end $$;

revoke all on function public.get_public_key_request_history(uuid,integer) from public;
revoke all on function public.get_public_key_request_options() from public;
revoke all on function public.create_key_request_v2(uuid,text,text,text,text,text,text,timestamptz,timestamptz,uuid) from public;
grant execute on function public.get_public_key_request_history(uuid,integer) to anon,authenticated;
grant execute on function public.get_public_key_request_options() to anon,authenticated;
grant execute on function public.create_key_request_v2(uuid,text,text,text,text,text,text,timestamptz,timestamptz,uuid) to anon,authenticated;

insert into public.booking_rules(rule_key,rule_value,description,active) values
 ('PUBLIC_KEY_HISTORY_IDENTITY_ENABLED','true'::jsonb,'Product owner approved full requester names for the latest 10 public key requests',true)
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description,active=true,updated_at=now();
