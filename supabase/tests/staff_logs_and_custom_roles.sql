-- Run against a development database with the standard roles and permissions seeded.
begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_role uuid;
  v_log jsonb;
begin
  insert into auth.users(id,email) values(v_admin,'role-audit-admin@example.test');
  insert into public.user_roles(user_id,role_id)
  select v_admin,id from public.roles where code='ADMIN';
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform public.manage_admin_role_label('CREATE','TEST_LABEL','ป้ายทดสอบ');
  select id into strict v_role from public.roles where code='TEST_LABEL';
  assert not exists (select 1 from public.role_permissions where role_id=v_role);
  perform public.manage_admin_role_label('RENAME','TEST_LABEL','ป้ายใหม่');
  v_log := public.get_staff_audit_logs('ADMIN',array['ROLE_LABEL_RENAME'],1);
  assert v_log->'rows'->0->>'reference'='TEST_LABEL';
  assert v_log->'rows'->0->>'detail'='ป้ายใหม่';

  perform public.add_admin_preassigned_user('role-audit-user@example.test','Test User',array['TEST_LABEL']);
  begin
    perform public.manage_admin_role_label('DELETE','TEST_LABEL',null);
    raise exception 'Assigned label was unexpectedly deleted';
  exception when foreign_key_violation then
    assert sqlerrm='ROLE_IN_USE';
  end;
  insert into auth.users(id,email,email_confirmed_at,last_sign_in_at)
  values(v_user,'role-audit-user@example.test',now(),now());
  assert (select array_agg(r.code order by r.code) from public.user_roles ur
    join public.roles r on r.id=ur.role_id where ur.user_id=v_user)=array['STUDENT','TEST_LABEL'];

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  begin
    perform public.get_staff_audit_logs(null,null,1);
    raise exception 'Regular user accessed audit logs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.manage_admin_role_label('CREATE','UNAUTHORIZED_LABEL','Forbidden');
    raise exception 'Regular user created a label';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  begin
    perform public.manage_admin_role_label('DELETE','ADMIN',null);
    raise exception 'Built-in role was unexpectedly deleted';
  exception when check_violation then
    assert sqlerrm='SYSTEM_ROLE_LOCKED';
  end;
  delete from public.user_roles where user_id=v_user and role_id=v_role;
  perform public.manage_admin_role_label('DELETE','TEST_LABEL',null);
  assert not exists (select 1 from public.roles where id=v_role);
end
$$;
rollback;
