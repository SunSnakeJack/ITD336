-- Teachers identify themselves as the instructor, so a separate course reference is optional.
-- Students opening a teaching room must still select an approved course/instructor option.
alter table public.key_requests drop constraint key_requests_teaching_fields;
alter table public.key_requests add constraint key_requests_teaching_fields check (
 purpose_type<>'TEACHING' or requester_type='TEACHER' or (
  nullif(btrim(course_code),'') is not null and nullif(btrim(course_name),'') is not null and
  nullif(btrim(lecturer_name),'') is not null and nullif(btrim(lecturer_email),'') is not null and
  lower(lecturer_email) ~ '^[^@[:space:]]+@northbkk[.]ac[.]th$'
 )
);

create or replace function public.create_key_request_v2(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_requester_type text,p_requester_identifier text,
 p_purpose_type text,p_purpose text,p_starts_at timestamptz,p_ends_at timestamptz,p_reference_option_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_id uuid;v_option public.key_request_reference_options;begin
 if p_requester_type not in('STUDENT','TEACHER') or nullif(btrim(p_requester_identifier),'') is null or length(btrim(p_requester_identifier))>50 then raise exception 'REQUESTER_IDENTITY_REQUIRED';end if;
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

revoke all on function public.create_key_request(uuid,text,text,text,text,timestamptz,timestamptz,text,text,text,text) from public,anon,authenticated;
revoke all on function public.create_key_request_v2(uuid,text,text,text,text,text,text,timestamptz,timestamptz,uuid) from public;
grant execute on function public.create_key_request_v2(uuid,text,text,text,text,text,text,timestamptz,timestamptz,uuid) to anon,authenticated;
