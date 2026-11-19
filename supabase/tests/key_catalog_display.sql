begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
begin
  delete from public.booking_rules where rule_key = 'KEY_CATALOG_DISPLAY';
  assert public.get_key_catalog_display() = 'current';
  assert has_function_privilege('anon', 'public.get_key_catalog_display()', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.set_key_catalog_display(text)', 'EXECUTE');

  insert into auth.users (id, email) values
    (v_admin, 'display-admin@example.test'), (v_student, 'display-student@example.test');
  insert into public.user_roles (user_id, role_id)
  select v_admin, id from public.roles where code = 'ADMIN'
  union all
  select v_student, id from public.roles where code = 'STUDENT';

  perform set_config('request.jwt.claim.sub', v_student::text, true);
  begin
    perform public.set_key_catalog_display('key-tags');
    raise exception 'Student changed the catalog setting';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  begin
    perform public.set_key_catalog_display('unknown');
    raise exception 'Saved an unsupported catalog layout';
  exception when invalid_parameter_value then null;
  end;
  assert public.set_key_catalog_display('key-tags') = 'key-tags';
  assert public.get_key_catalog_display() = 'key-tags';
  assert public.set_key_catalog_display('current') = 'current';
  assert public.get_key_catalog_display() = 'current';
  assert exists (select 1 from public.audit_logs
    where action = 'KEY_CATALOG_DISPLAY_UPDATED' and actor_id = v_admin);
end;
$$;
rollback;
