create schema if not exists private;

-- Internal directory shared by the selector and submission RPC. The browser
-- only receives IDs and display names through the existing public RPC.
create function private.key_request_lecturer_directory()
returns table(id uuid, name text, email text)
language sql stable set search_path = '' as $$
  with candidates as (
    select l.id, l.name, l.email, 1 as priority
    from public.key_request_lecturers l
    where l.active and (
      l.email = 'sufeeyan2003@gmail.com'
      or not exists (
        select 1 from public.profiles p
        where lower(btrim(p.email)) = l.email
          and (p.account_status <> 'ACTIVE' or p.deleted_at is not null)
      )
    )
    union all
    select p.id, btrim(p.full_name), lower(btrim(p.email)), 2
    from public.profiles p
    where auth.uid() is not null and p.account_status = 'ACTIVE' and p.deleted_at is null
      and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = p.id and r.code = 'TEACHER'
      )
    union all
    select p.id, btrim(p.full_name), lower(btrim(p.email)), 3
    from public.preassigned_user_roles p
    where auth.uid() is not null and (
      p.role_code = 'TEACHER' or exists (
        select 1 from public.preassigned_user_additional_roles a
        where a.preassignment_id = p.id and a.role_code = 'TEACHER'
      )
    ) and not exists (
      select 1 from public.profiles account
      where lower(btrim(account.email)) = lower(btrim(p.email))
        and (account.account_status <> 'ACTIVE' or account.deleted_at is not null)
    )
  )
  select distinct on (c.email)
    c.id,
    case when nullif(c.name, '') is null or lower(c.name) = c.email
      then split_part(c.email, '@', 1) else c.name end,
    c.email
  from candidates c
  where c.email ~ '^[^@[:space:]]+@northbkk[.]ac[.]th$'
    or (c.email = 'sufeeyan2003@gmail.com' and c.name = 'sufeeyan(test)')
  order by c.email, c.priority, c.id
$$;

revoke all on function private.key_request_lecturer_directory() from public, anon, authenticated;

create or replace function public.get_public_key_request_lecturers()
returns table(id uuid, lecturer_name text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name from private.key_request_lecturer_directory() l
  order by l.name, l.id
$$;

create or replace function public.create_teaching_key_request(
  p_room_id uuid, p_requester_name text, p_requester_email text,
  p_requester_type text, p_requester_identifier text, p_purpose text,
  p_starts_at timestamptz, p_ends_at timestamptz,
  p_course_code text, p_course_name text, p_lecturer_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_lecturer record;
  v_result jsonb;
  v_course_code text := nullif(btrim(p_course_code), '');
  v_course_name text := nullif(btrim(p_course_name), '');
begin
  if p_requester_type is null or p_requester_type not in ('STUDENT', 'TEACHER')
    or (p_requester_identifier is not null and btrim(p_requester_identifier) !~ '^[0-9]{1,50}$') then
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

  select * into v_lecturer from private.key_request_lecturer_directory()
    where id = p_lecturer_id;
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
