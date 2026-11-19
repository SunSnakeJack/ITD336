-- Run after migrations and development seed have been applied.
begin;

do $$
declare
  v_teacher uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
begin
  assert not has_table_privilege('anon', 'public.preassigned_user_roles', 'SELECT');
  assert not has_table_privilege('authenticated', 'public.preassigned_user_roles', 'SELECT');
  assert not has_function_privilege('anon', 'public.get_admin_user_directory_v3()', 'EXECUTE');

  insert into auth.users (id, email) values (v_admin, 'role-test-admin@example.test');
  insert into public.user_roles (user_id, role_id)
  select v_admin, id from public.roles where code = 'ADMIN';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  insert into public.preassigned_user_roles (email, full_name, role_code)
  values ('reserved@example.test', 'Reserved Instructor', 'TEACHER');

  insert into auth.users (id, email, last_sign_in_at)
  values (v_teacher, 'Reserved@Example.Test', now());
  assert not exists (select 1 from public.user_roles where user_id = v_teacher),
    'An unconfirmed email must not consume a reservation';
  assert exists (select 1 from public.preassigned_user_roles where email = 'reserved@example.test');
  assert (select count(*) from public.get_admin_user_directory_v3()
    where lower(email) = 'reserved@example.test') = 1;
  assert exists (select 1 from public.get_admin_user_directory_v3()
    where email = 'reserved@example.test' and pending_registration and role_codes = array['TEACHER']);

  update auth.users set email_confirmed_at = now() where id = v_teacher;
  assert (select array_agg(r.code) from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = v_teacher) = array['TEACHER'];
  assert not exists (select 1 from public.preassigned_user_roles where email = 'reserved@example.test');
  assert exists (select 1 from public.get_admin_user_directory_v3()
    where user_id = v_teacher and not pending_registration and role_codes = array['TEACHER']);
  perform set_config('request.jwt.claim.sub', v_teacher::text, true);
  begin
    perform public.get_admin_user_directory_v3();
    raise exception 'A teacher must not be able to read the admin directory';
  exception when insufficient_privilege then
    null;
  end;

  insert into auth.users (id, email, email_confirmed_at, last_sign_in_at)
  values (v_student, 'new-student@example.test', now(), now());
  assert (select array_agg(r.code) from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = v_student) = array['STUDENT'];

  insert into auth.users (id, email, email_confirmed_at)
  values (v_staff, 'new-staff@example.test', now());
  insert into public.user_roles (user_id, role_id)
  select v_staff, id from public.roles where code = 'STAFF';
  update auth.users set last_sign_in_at = now() where id = v_staff;
  assert (select array_agg(r.code) from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = v_staff) = array['STAFF'];

  delete from public.user_roles where user_id = v_teacher;
  update auth.users set last_sign_in_at = now() + interval '1 minute' where id = v_teacher;
  assert not exists (select 1 from public.user_roles where user_id = v_teacher),
    'Later sign-ins must not reassign a role removed by an administrator';
end;
$$;

rollback;
