begin;

do $$
declare
  v_teacher uuid := gen_random_uuid();
  v_pending uuid := gen_random_uuid();
  v_duplicate uuid := gen_random_uuid();
begin
  assert not has_function_privilege('anon', 'private.key_request_lecturer_directory()', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'private.key_request_lecturer_directory()', 'EXECUTE');
  insert into auth.users (id, email) values (v_teacher, 'directory-test-teacher@northbkk.ac.th');
  update public.profiles set full_name = 'Directory Test Teacher', account_status = 'ACTIVE' where id = v_teacher;
  insert into public.user_roles (user_id, role_id)
  select v_teacher, id from public.roles where code = 'TEACHER'
  on conflict do nothing;

  insert into public.preassigned_user_roles (id, email, full_name, role_code) values
    (v_pending, 'directory-test-pending@northbkk.ac.th', 'อาจารย์ทดสอบ', 'STAFF'),
    (v_duplicate, 'directory-test-teacher@northbkk.ac.th', 'Duplicate Teacher', 'TEACHER');
  insert into public.preassigned_user_additional_roles (preassignment_id, role_code)
  values (v_pending, 'TEACHER');

  perform set_config('request.jwt.claim.sub', '', true);
  assert not exists (select 1 from public.get_public_key_request_lecturers() where id = v_teacher);
  perform set_config('request.jwt.claim.sub', v_teacher::text, true);
  assert exists (select 1 from public.get_public_key_request_lecturers() where id = v_teacher and lecturer_name = 'Directory Test Teacher');
  assert exists (select 1 from public.get_public_key_request_lecturers() where id = v_pending and lecturer_name = 'อาจารย์ทดสอบ');
  assert not exists (select 1 from public.get_public_key_request_lecturers() where id = v_duplicate);
  assert exists (select 1 from public.get_public_key_request_lecturers() where lecturer_name = 'sufeeyan(test)');
  assert exists (select 1 from private.key_request_lecturer_directory()
    where id = v_pending and email = 'directory-test-pending@northbkk.ac.th');
  update public.profiles set account_status = 'SUSPENDED' where id = v_teacher;
  assert not exists (select 1 from public.get_public_key_request_lecturers() where id in (v_teacher, v_duplicate));
  begin
    perform public.create_teaching_key_request(
      gen_random_uuid(), 'Student Test', 'student@northbkk.ac.th', 'STUDENT', null,
      'Teaching', now(), now() + interval '30 minutes', 'ITD336', null, v_teacher
    );
    raise exception 'Suspended lecturer was accepted';
  exception when raise_exception then
    if sqlerrm <> 'REFERENCE_OPTION_REQUIRED' then raise; end if;
  end;
end $$;

rollback;
