begin;
do $$
declare
 v_admin uuid := gen_random_uuid();
 v_student uuid := gen_random_uuid();
 v_role uuid;
 v_grants uuid[];
begin
 insert into auth.users(id,email) values (v_admin,'role-label-admin@example.test'),(v_student,'role-label-student@example.test');
 insert into public.user_roles(user_id,role_id)
 select v_admin,id from public.roles where code='ADMIN'
 union all select v_student,id from public.roles where code='STUDENT';
 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 select id into strict v_role from public.roles where code='ADMIN';
 v_grants := array(select permission_id from public.role_permissions where role_id=v_role order by permission_id);
 assert exists(select 1 from public.get_admin_role_catalog_v2() where code='ADMIN' and name_th='ผู้ดูแลระบบ' and locked);
 perform public.manage_admin_role_label_v2('RENAME','ADMIN','System Administrator','ผู้ดูแลระบบหลัก');
 assert exists(select 1 from public.roles where id=v_role and code='ADMIN' and name='System Administrator' and name_th='ผู้ดูแลระบบหลัก');
 assert v_grants=array(select permission_id from public.role_permissions where role_id=v_role order by permission_id);
 perform public.manage_admin_role_label_v2('CREATE','TEST_BILINGUAL','Test Role','ทดสอบ');
 assert exists(select 1 from public.get_admin_role_catalog_v2() where code='TEST_BILINGUAL' and name='Test Role' and name_th='ทดสอบ' and not locked);
 begin
  perform public.manage_admin_role_label_v2('DELETE','ADMIN',null,null);
  raise exception 'System role deletion unexpectedly succeeded';
 exception when check_violation then assert sqlerrm='SYSTEM_ROLE_LOCKED';
 end;
 perform set_config('request.jwt.claim.sub',v_student::text,true);
 begin
  perform public.manage_admin_role_label_v2('RENAME','ADMIN','Unauthorized','ไม่ได้รับอนุญาต');
  raise exception 'Unauthorized rename unexpectedly succeeded';
 exception when insufficient_privilege then assert sqlerrm='FORBIDDEN';
 end;
 assert not has_function_privilege('anon','public.manage_admin_role_label_v2(text,text,text,text)','execute');
end $$;
rollback;
