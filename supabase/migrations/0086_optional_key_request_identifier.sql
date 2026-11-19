-- New forms send NULL for the optional identifier. Existing callers can still send an identifier.

create or replace function public.create_key_request_v2(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_requester_type text,p_requester_identifier text,
 p_purpose_type text,p_purpose text,p_starts_at timestamptz,p_ends_at timestamptz,p_reference_option_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_id uuid;v_option public.key_request_reference_options;begin
 if p_requester_type is null or p_requester_type not in('STUDENT','TEACHER') or (p_requester_identifier is not null and (btrim(p_requester_identifier) = '' or length(btrim(p_requester_identifier)) > 50)) then raise exception 'REQUESTER_IDENTITY_REQUIRED';end if;
 if p_requester_type='STUDENT' and p_purpose_type='TEACHING' then
  select * into v_option from public.key_request_reference_options where id=p_reference_option_id and active;
  if not found then raise exception 'REFERENCE_OPTION_REQUIRED';end if;
 end if;
 if p_requester_type='TEACHER' and p_purpose_type='TEACHING' then
  v_result:=public.create_key_request(p_room_id,p_requester_name,p_requester_email,'OTHER',p_purpose,p_starts_at,p_ends_at,null,null,null,null);
 else
  v_result:=public.create_key_request(p_room_id,p_requester_name,p_requester_email,p_purpose_type,p_purpose,p_starts_at,p_ends_at,
   v_option.course_code,v_option.course_name,v_option.lecturer_name,v_option.lecturer_email);
 end if;
 v_id:=(v_result->>'id')::uuid;
 update public.key_requests set requester_type=p_requester_type,requester_identifier=btrim(p_requester_identifier),
  purpose_type=case when p_requester_type='TEACHER' and p_purpose_type='TEACHING' then 'TEACHING' else purpose_type end
 where id=v_id;
 return v_result;
end $$;

create or replace function public.create_teaching_key_request(
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
