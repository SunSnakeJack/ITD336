begin;

do $$
begin
  assert not has_function_privilege('anon', 'public.preview_key_request_email_action(text,text)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.consume_key_request_action(text,text)', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.preview_key_request_email_action(text,text)', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.consume_key_request_action(text,text)', 'EXECUTE');

  assert exists (select 1 from pg_trigger where tgrelid = 'public.bookings'::regclass
    and tgname = 'booking_change_email' and tgenabled <> 'D');
  assert exists (select 1 from pg_trigger where tgrelid = 'public.key_requests'::regclass
    and tgname = 'key_request_change_email' and tgenabled <> 'D');

  assert public.preview_key_request_email_action(repeat('0', 64), 'CANCEL') is null;
end $$;

rollback;
