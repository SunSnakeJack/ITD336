create table public.key_request_lecturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  active boolean not null default true,
  check (email ~ '^[^@[:space:]]+@northbkk[.]ac[.]th$' or email = 'sufeeyan2003@gmail.com')
);

alter table public.key_request_lecturers enable row level security;
revoke all on public.key_request_lecturers from public, anon, authenticated;

insert into public.key_request_lecturers(name, email) values
  ('อ. ปิติพัฒน์ เจิมบุญธนะพงศ์', 'pitiphat.jo@northbkk.ac.th'),
  ('อ. พลวัฒน์ ต่อตระกูล', 'ponlawat.to@northbkk.ac.th'),
  ('sufeeyan(test)', 'sufeeyan2003@gmail.com');

create function public.get_public_key_request_lecturers()
returns table(id uuid, lecturer_name text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name from public.key_request_lecturers l where l.active order by l.name, l.id
$$;

alter table public.key_requests drop constraint key_requests_teaching_fields;
alter table public.key_requests add constraint key_requests_teaching_fields check (
  purpose_type <> 'TEACHING' or requester_type = 'TEACHER' or (
    nullif(btrim(course_code), '') is not null and nullif(btrim(course_name), '') is not null
    and nullif(btrim(lecturer_name), '') is not null and nullif(btrim(lecturer_email), '') is not null
    and (lower(lecturer_email) ~ '^[^@[:space:]]+@northbkk[.]ac[.]th$'
      or (lower(lecturer_email) = 'sufeeyan2003@gmail.com' and lecturer_name = 'sufeeyan(test)'))
  )
);

create function public.create_teaching_key_request(
  p_room_id uuid, p_requester_name text, p_requester_email text,
  p_requester_type text, p_requester_identifier text, p_purpose text,
  p_starts_at timestamptz, p_ends_at timestamptz,
  p_course_code text, p_course_name text, p_lecturer_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lecturer public.key_request_lecturers;
  v_result jsonb;
  v_course_code text := nullif(btrim(p_course_code), '');
  v_course_name text := nullif(btrim(p_course_name), '');
begin
  if p_requester_type is null or p_requester_type not in ('STUDENT', 'TEACHER')
    or coalesce(btrim(p_requester_identifier), '') !~ '^[0-9]{1,50}$' then
    raise exception 'REQUESTER_IDENTITY_REQUIRED';
  end if;
  if v_course_code is null then raise exception 'COURSE_CODE_REQUIRED'; end if;
  if p_requester_type = 'TEACHER' then
    v_result := public.create_key_request_v2(p_room_id, p_requester_name, p_requester_email,
      p_requester_type, p_requester_identifier, 'TEACHING', p_purpose, p_starts_at, p_ends_at, null);
    update public.key_requests set course_code = v_course_code, course_name = v_course_name
      where id = (v_result ->> 'id')::uuid;
    return v_result;
  end if;

  select * into v_lecturer from public.key_request_lecturers
    where id = p_lecturer_id and active;
  if not found then raise exception 'REFERENCE_OPTION_REQUIRED'; end if;
  v_result := public.create_key_request(p_room_id, p_requester_name, p_requester_email,
    'TEACHING', p_purpose, p_starts_at, p_ends_at, v_course_code,
    coalesce(v_course_name, v_course_code), v_lecturer.name, v_lecturer.email);
  update public.key_requests set requester_type = p_requester_type,
    requester_identifier = btrim(p_requester_identifier)
    where id = (v_result ->> 'id')::uuid;
  return v_result;
end;
$$;

revoke all on function public.get_public_key_request_lecturers(),
  public.create_teaching_key_request(uuid, text, text, text, text, text, timestamptz, timestamptz, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.get_public_key_request_lecturers(),
  public.create_teaching_key_request(uuid, text, text, text, text, text, timestamptz, timestamptz, text, text, uuid)
  to anon, authenticated;
