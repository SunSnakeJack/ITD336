begin;

do $$
declare
  v_room uuid;
  v_request uuid;
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_unverified uuid := gen_random_uuid();
begin
  select id into strict v_room from public.rooms where code = 'S2407';
  insert into auth.users (id, email, email_confirmed_at) values
    (v_owner, 'cancel-owner@example.test', now()),
    (v_other, 'cancel-other@example.test', now()),
    (v_unverified, 'cancel-unverified@example.test', null);

  insert into public.key_requests (
    room_id, requester_name, requester_email, purpose_type, purpose,
    starts_at, ends_at, status, approval_mode
  ) values (
    v_room, 'Cancellation test', 'cancel-unverified@example.test', 'OTHER', 'Test',
    now() + interval '1 day', now() + interval '1 day 1 hour', 'PENDING_APPROVAL', 'ADMIN'
  ) returning id into v_request;

  perform set_config('request.jwt.claim.sub', v_unverified::text, true);
  begin
    perform public.cancel_my_key_request(v_request);
    assert false, 'An unverified email must not authorize cancellation';
  exception when insufficient_privilege then null;
  end;

  update public.key_requests set requester_email = 'cancel-owner@example.test' where id = v_request;
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  begin
    perform public.cancel_my_key_request(v_request);
    assert false, 'A different verified email must not authorize cancellation';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  assert public.cancel_my_key_request(v_request)->>'status' = 'CANCELLED';
end $$;

rollback;
