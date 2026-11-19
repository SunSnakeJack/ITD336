begin;
do $$
declare
  v_role text;
  v_user uuid;
begin
  foreach v_role in array array['DEAN', 'DEPARTMENT_HEAD', 'PRIORITY_USER'] loop
    v_user := gen_random_uuid();
    insert into auth.users (id, email) values (v_user, lower(v_role) || '@example.test');
    insert into public.user_roles (user_id, role_id)
    select v_user, id from public.roles where code = v_role;
    perform set_config('request.jwt.claim.sub', v_user::text, true);
    assert public.has_role('PRIORITY_USER');
    assert public.has_permission('BOOKING_OVERRIDE');
    assert not public.has_role('ADMIN');
    update public.profiles set account_status = 'SUSPENDED' where id = v_user;
    assert not public.has_role('PRIORITY_USER');
    assert not public.has_permission('BOOKING_OVERRIDE');
  end loop;
end;
$$;
rollback;
