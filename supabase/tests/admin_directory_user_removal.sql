-- Run against a disposable database with migrations and roles applied.
begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_pending uuid := gen_random_uuid();
begin
  assert not has_function_privilege('anon', 'public.remove_admin_directory_user(uuid,boolean)', 'EXECUTE');
  insert into auth.users (id, email) values
    (v_admin, 'remove-admin@example.test'),
    (v_student, 'remove-student@example.test');
  insert into public.user_roles (user_id, role_id)
  select v_admin, id from public.roles where code = 'ADMIN';
  insert into public.preassigned_user_roles(id, email, full_name, role_code)
  values (v_pending, 'remove-pending@example.test', 'Pending Teacher', 'TEACHER');

  perform set_config('request.jwt.claim.sub', v_student::text, true);
  begin
    perform public.remove_admin_directory_user(v_pending, true);
    raise exception 'A non-admin could remove a preassignment';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  begin
    perform public.remove_admin_directory_user(v_admin, false);
    raise exception 'The admin could remove their own account';
  exception when invalid_parameter_value then null;
  end;

  perform public.remove_admin_directory_user(v_pending, true);
  perform public.remove_admin_directory_user(v_student, false);
  assert not exists (
    select 1 from public.get_admin_user_directory_v3() where user_id in (v_pending, v_student)
  );
  assert exists (
    select 1 from public.profiles where id = v_student and deleted_at is not null and account_status = 'INACTIVE'
  );
  assert exists (select 1 from auth.users where id = v_student and banned_until > now());
  assert not exists (select 1 from public.preassigned_user_roles where id = v_pending);
  assert exists (
    select 1 from public.audit_logs where actor_id = v_admin and entity_id = v_student and action = 'USER_REMOVED'
  );

  begin
    update auth.users set banned_until = null where id = v_student;
    raise exception 'A deleted user could be unbanned';
  exception when check_violation then null;
  end;
end;
$$;
rollback;
