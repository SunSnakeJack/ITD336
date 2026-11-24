begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_id uuid;
  v_email text := 'preassignment-edit@northbkk.ac.th';
begin
  insert into auth.users(id, email) values (v_admin, 'preassignment-admin@northbkk.ac.th');
  insert into public.user_roles(user_id, role_id)
  select v_admin, id from public.roles where code = 'ADMIN';
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_id := public.add_admin_preassigned_user(v_email, 'Before edit', array['STUDENT']);
  perform public.update_admin_preassigned_user(v_id, 'After edit', array['TEACHER', 'STAFF']);
  assert exists (
    select 1 from public.get_admin_user_directory_v3()
    where user_id = v_id and email = v_email and full_name = 'After edit'
      and pending_registration and role_codes = array['STAFF', 'TEACHER']
  );
  assert not has_function_privilege('anon', 'public.update_admin_preassigned_user(uuid,text,text[])', 'EXECUTE');
  begin
    perform public.update_admin_preassigned_user(v_id, 'Invalid edit', array[]::text[]);
    raise exception 'Empty role list accepted';
  exception when invalid_parameter_value then
    assert sqlerrm = 'INVALID_ROLE';
  end;

  insert into auth.users(id, email, email_confirmed_at, last_sign_in_at)
  values (v_user, v_email, now(), now());
  assert (
    select array_agg(r.code order by r.code)
    from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = v_user
  ) = array['STAFF', 'TEACHER'];

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  begin
    perform public.update_admin_preassigned_user(v_id, 'Forbidden edit', array['ADMIN']);
    raise exception 'Non-admin edit accepted';
  exception when insufficient_privilege then
    assert sqlerrm = 'FORBIDDEN';
  end;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  begin
    perform public.update_admin_preassigned_user(v_id, 'Stale edit', array['ADMIN']);
    raise exception 'Stale edit accepted';
  exception when no_data_found then
    assert sqlerrm = 'PREASSIGNMENT_NOT_FOUND';
  end;
end;
$$;
rollback;
