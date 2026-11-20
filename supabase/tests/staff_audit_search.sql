begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_result jsonb;
begin
  insert into auth.users(id,email) values
    (v_admin,'audit-search-admin@example.test'),(v_user,'audit-search-user@example.test');
  insert into public.user_roles(user_id,role_id)
  select v_admin,id from public.roles where code='ADMIN';
  update public.profiles set full_name='ผู้ทดสอบ AuditSearch' where id=v_user;
  insert into public.audit_logs(actor_id,action,entity_type,metadata)
  select v_user,'KEY_REQUEST_CREATED','key_request',jsonb_build_object('reason','ค้นหาพิเศษ AuditTerm951')
  from generate_series(1,11);
  insert into public.audit_logs(actor_id,action,entity_type,metadata)
  values (v_admin,'KEY_REQUEST_CREATED','key_request','{"reason":"AuditTerm951"}'),
         (v_user,'KEY_REQUEST_RETURNED','key_request','{"reason":"AuditTerm951"}');
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  v_result := public.get_staff_audit_logs_search('USER',array['KEY_REQUEST_CREATED'],2,'  AUDITTERM951  ');
  assert (v_result->>'total')::integer=11;
  assert jsonb_array_length(v_result->'rows')=1;
  v_result := public.get_staff_audit_logs_search('USER',array['KEY_REQUEST_CREATED'],1,'ผู้ทดสอบ AuditSearch');
  assert (v_result->>'total')::integer=11;
  assert jsonb_array_length(v_result->'rows')=10;
  v_result := public.get_staff_audit_logs_search('USER',array['KEY_REQUEST_CREATED'],1,'AuditTerm951%');
  assert (v_result->>'total')::integer=0;
end
$$;
rollback;
