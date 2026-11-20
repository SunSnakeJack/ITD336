begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_pending uuid := gen_random_uuid();
begin
  assert not has_table_privilege('authenticated', 'private.lecturer_display_names', 'SELECT');
  assert not has_function_privilege('anon', 'public.set_lecturer_name_language(text)', 'EXECUTE');
  assert not has_function_privilege('anon',
    'public.set_admin_lecturer_display_names(uuid, boolean, text, text)', 'EXECUTE');

  insert into auth.users (id, email) values (v_admin, 'lecturer-settings-admin@example.test');
  insert into public.user_roles (user_id, role_id)
  select v_admin, id from public.roles where code = 'ADMIN'
  on conflict do nothing;
  insert into public.preassigned_user_roles (id, email, full_name, role_code)
  values (v_pending, 'lecturer-display-test@northbkk.ac.th', 'Original Name', 'TEACHER');

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.set_admin_lecturer_display_names(v_pending, true, 'อาจารย์ทดสอบ', 'English Name');
  perform public.set_lecturer_name_language('en');
  assert exists (select 1 from public.get_public_key_request_lecturers_v2()
    where id = v_pending and lecturer_name = 'English Name' and name_th = 'อาจารย์ทดสอบ');
  perform public.set_lecturer_name_language('th');
  assert exists (select 1 from public.get_public_key_request_lecturers_v2()
    where id = v_pending and lecturer_name = 'อาจารย์ทดสอบ' and name_en = 'English Name');

  perform public.set_admin_lecturer_display_names(v_pending, true, null, 'English Name');
  assert exists (select 1 from public.get_public_key_request_lecturers_v2()
    where id = v_pending and lecturer_name = 'Original Name');
  assert exists (select 1 from private.key_request_lecturer_directory()
    where id = v_pending and email = 'lecturer-display-test@northbkk.ac.th');
end $$;

rollback;
