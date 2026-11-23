begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
begin
  delete from public.booking_rules where rule_key = 'PUBLIC_NAVIGATION_MODE';
  assert public.get_public_navigation_mode() = 'top';
  assert has_function_privilege('anon', 'public.get_public_navigation_mode()', 'EXECUTE');
  assert not has_function_privilege('anon', 'public.set_public_navigation_mode(text)', 'EXECUTE');
  insert into auth.users(id,email) values
    (v_admin,'navigation-mode-admin@example.test'), (v_user,'navigation-mode-user@example.test');
  insert into public.user_roles(user_id, role_id)
  select v_admin,id from public.roles where code = 'ADMIN' on conflict do nothing;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  begin
    perform public.set_public_navigation_mode('both');
    raise exception 'Regular user changed navigation mode';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  assert public.set_public_navigation_mode('bottom') = 'bottom';
  assert public.get_public_navigation_mode() = 'bottom';
  assert public.set_public_navigation_mode('both') = 'both';
  assert public.get_public_navigation_mode() = 'both';
  begin
    perform public.set_public_navigation_mode('invalid');
    raise exception 'Invalid navigation mode was accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
rollback;
