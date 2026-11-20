begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_filtered jsonb;
  v_before integer;
begin
  insert into auth.users(id,email) values
    (v_admin,'legacy-audit-admin@example.test'),(v_user,'legacy-audit-user@example.test');
  insert into public.user_roles(user_id,role_id)
  select v_admin,id from public.roles where code='ADMIN';
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  select (public.get_staff_audit_logs('USER',array['KEY_REQUEST_CREATED'],1)->>'total')::integer into v_before;

  insert into public.audit_logs(actor_id,action,entity_type,created_at)
  select v_user,'KEY_REQUEST_CREATED','key_request',now()+interval '100 years'
  from generate_series(1,11);
  -- Simulate rows written before actor snapshots were available.
  update public.audit_logs set actor_kind=null where actor_id=v_user and action='KEY_REQUEST_CREATED';
  insert into public.audit_logs(actor_id,action,entity_type,created_at)
  values (v_user,'USER_ROLES_UPDATED','profile',now()+interval '100 years');
  update public.audit_logs set actor_kind=null where actor_id=v_user and action='USER_ROLES_UPDATED';

  v_filtered := public.get_staff_audit_logs('USER',array['KEY_REQUEST_CREATED'],1);
  assert (v_filtered->>'total')::integer = v_before + 11;
  assert jsonb_array_length(v_filtered->'rows') = 10;
  assert v_filtered->'rows'->0->>'actorKindEstimated'='true';
  v_filtered := public.get_staff_audit_logs('USER',array['KEY_REQUEST_CREATED'],2);
  assert v_filtered->'rows'->0->>'actorKind'='USER';
  v_filtered := public.get_staff_audit_logs('ADMIN',array['USER_ROLES_UPDATED'],1);
  assert v_filtered->'rows'->0->>'actorKindEstimated'='false';
  assert v_filtered->'rows'->0->>'actorKind'='ADMIN';
end
$$;
rollback;
