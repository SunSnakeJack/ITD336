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
 assert (select count(*)=28 from pg_tables where schemaname='public'), 'expected 28 application tables';
 assert (select count(*)=28 from pg_tables where schemaname='public' and rowsecurity), 'RLS must cover all application tables';
 assert not exists(
  select 1 from role_permissions rp join roles r on r.id=rp.role_id join permissions p on p.id=rp.permission_id
  where r.code='STAFF' and p.code in ('ROOM_MANAGE','SCHEDULE_MANAGE','BOOKING_APPROVE','BOOKING_MANAGE','KEY_MANAGE','USER_MANAGE','SETTINGS_MANAGE','AUDIT_READ')
 ), 'STAFF retains write/admin permissions';
 assert exists(select 1 from pg_indexes where indexname='one_active_loan_per_key' and indexdef like '%RETURN_REPORTED%'), 'active key uniqueness excludes return-reported loans';
end $$;
rollback;
