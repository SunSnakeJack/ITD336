-- Requirements V2 structural checks. Run only in a disposable database after all migrations and seed.
begin;
do $$
begin
 assert exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='booking_status' and e.enumlabel='SUPERSEDED'), 'SUPERSEDED booking status missing';
 assert exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='key_loan_status' and e.enumlabel='RETURN_REPORTED'), 'RETURN_REPORTED loan status missing';
 assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='key_loans' and column_name='usage_source'), 'key usage source missing';
 assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='override_booking'), 'override RPC missing';
 assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='borrow_key'), 'borrow-key RPC missing';
 assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='confirm_key_return'), 'self-return RPC missing';
 assert (select count(*)=29 from pg_tables where schemaname='public'), 'expected 29 application tables';
 assert (select count(*)=29 from pg_tables where schemaname='public' and rowsecurity), 'RLS must cover all application tables';
 assert not exists(
  select 1 from role_permissions rp join roles r on r.id=rp.role_id join permissions p on p.id=rp.permission_id
  where r.code='STAFF' and p.code in ('ROOM_MANAGE','SCHEDULE_MANAGE','BOOKING_APPROVE','BOOKING_MANAGE','KEY_MANAGE','USER_MANAGE','SETTINGS_MANAGE','AUDIT_READ')
 ), 'STAFF retains write/admin permissions';
 assert exists(select 1 from pg_trigger where tgname='enforce_single_room_key_holder' and not tgisinternal), 'room-level key holder trigger missing';
 assert position('status=''RETURNED''' in pg_get_functiondef('public.report_key_status(uuid,text,text)'::regprocedure))>0, 'self-service return does not complete immediately';
 assert position('''APPROVED''' in pg_get_functiondef('public.request_booking_key(uuid,text)'::regprocedure))>0, 'booking-key request is not automatically approved';
 assert (select rule_value#>>'{}'='18:30' from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active), 'final 17:30-18:30 booking slot is outside operating hours';
 assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='reconcile_expired_bookings'), 'expired-booking reconciliation RPC missing';
 assert position('BOOKING_ALREADY_ENDED' in pg_get_functiondef('public.cancel_booking(uuid,text)'::regprocedure))>0, 'expired booking cancellation guard missing';
end $$;
rollback;
