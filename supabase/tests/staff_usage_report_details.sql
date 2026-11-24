begin;
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_room uuid := gen_random_uuid();
  v_request uuid;
  v_start timestamptz := (date_trunc('week', now() at time zone 'Asia/Bangkok') + interval '7 days 10 hours') at time zone 'Asia/Bangkok';
begin
  assert not has_function_privilege('anon', 'public.get_staff_usage_report_details()', 'EXECUTE');
  assert has_function_privilege('authenticated', 'public.get_staff_usage_report_details()', 'EXECUTE');
  insert into auth.users(id, email) values
    (v_admin, 'report-admin@northbkk.ac.th'), (v_student, 'report-student@northbkk.ac.th');
  insert into public.user_roles(user_id, role_id)
    select v_admin, id from public.roles where code = 'ADMIN'
    union all select v_student, id from public.roles where code = 'STUDENT';
  insert into public.permissions(code, description) values ('REPORT_READ', 'Read reports') on conflict do nothing;
  insert into public.role_permissions(role_id, permission_id)
    select r.id, p.id from public.roles r cross join public.permissions p
    where r.code = 'ADMIN' and p.code = 'REPORT_READ' on conflict do nothing;
  insert into public.rooms(id, code, layout_key, name, room_type_id, capacity)
    select v_room, 'REPORT-ROOM', 'report-test-layout', 'Report test', id, 20
    from public.room_types where code = 'COMPUTER';
  insert into public.key_requests(room_id, requester_name, requester_email, purpose_type, purpose, starts_at, ends_at,
    status, approval_mode, requester_type)
  values (v_room, 'Report test', 'anonymous-report@northbkk.ac.th', 'OTHER', 'Report test',
    v_start, v_start + interval '30 minutes', 'APPROVED', 'AUTO', 'STUDENT')
  returning id into v_request;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  assert exists (
    select 1 from public.get_staff_usage_report_details()
    where transaction_id = 'key-request:' || v_request::text
      and user_type = 'STUDENT' and user_key like 'guest:%' and checked_out_at is null
  );
  perform set_config('request.jwt.claim.sub', v_student::text, true);
  begin
    assert not exists (select 1 from public.get_staff_usage_report_details());
  exception when insufficient_privilege then
    assert sqlerrm = 'FORBIDDEN';
  end;
end;
$$;
rollback;
