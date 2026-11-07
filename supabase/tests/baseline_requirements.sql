-- Approved FR/NFR baseline database checks.
-- Run only after all migrations in a disposable local/test database.
begin;

do $$
begin
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='key_requests'), 'key_requests missing';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='key_request_status_history'), 'key request history missing';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='secure_action_tokens'), 'secure tokens missing';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='notification_outbox'), 'notification outbox missing';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='booking_segments'), 'booking segments missing';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='sync_runs'), 'sync runs missing';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='sync_change_impacts'), 'sync impacts missing';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='announcements'), 'announcements missing';

  assert (select count(*)=8 from pg_tables where schemaname='public' and tablename in
    ('key_requests','key_request_status_history','secure_action_tokens','notification_outbox',
     'booking_segments','sync_runs','sync_change_impacts','announcements') and rowsecurity),
    'RLS must cover every new workflow table';

  assert exists(select 1 from pg_constraint where conname='no_overlapping_active_key_requests' and contype='x'),
    'pending/approved key requests need an exclusion constraint';
  assert exists(select 1 from pg_constraint where conname='secure_action_tokens_digest_key'),
    'token digests must be unique';
  assert exists(select 1 from pg_constraint where conname='notification_outbox_idempotency_key_key'),
    'outbox idempotency keys must be unique';

  assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='room_types' and column_name='usage_scope'),
    'room usage scope missing';
  assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='room_types' and column_name='requires_sso_for_key_request'),
    'room SSO policy missing';
  assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='room_types' and column_name='default_key_approval_mode'),
    'room approval policy missing';
  assert exists(select 1 from information_schema.columns where table_schema='public' and table_name='rooms' and column_name='key_approval_mode'),
    'per-room approval override missing';

  assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_key_request'),
    'key-request RPC missing';
  assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='decide_key_request'),
    'approval RPC missing';
  assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='consume_key_request_action'),
    'secure action RPC missing';
  assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_priority_booking_override'),
    'transactional priority override RPC missing';
  assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='claim_notification_outbox'),
    'outbox claim RPC missing';
  assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='create_meeting_booking'),
    'meeting-only booking RPC missing';
  assert exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='update_room_key_approval_mode'),
    'per-room approval update RPC missing';
  assert exists(select 1 from pg_trigger where tgname='enforce_key_request_entry_rules' and not tgisinternal),
    'key-request email and Saturday guard missing';
  assert position('northbkk' in pg_get_functiondef('public.enforce_key_request_entry_rules()'::regprocedure))>0,
    'university email domain is not enforced by the database';
  assert position('SATURDAY_NOT_AVAILABLE' in pg_get_functiondef('public.enforce_key_request_entry_rules()'::regprocedure))>0,
    'Saturday key requests are not rejected by the database';

  assert not has_table_privilege('anon','public.key_requests','SELECT'), 'anonymous can read key requests';
  assert not has_table_privilege('anon','public.key_requests','INSERT'), 'anonymous can insert key requests directly';
  assert not has_table_privilege('authenticated','public.key_requests','INSERT'), 'authenticated can bypass request RPC';
  assert not has_table_privilege('authenticated','public.secure_action_tokens','SELECT'), 'authenticated can read token digests';
  assert not has_table_privilege('authenticated','public.notification_outbox','UPDATE'), 'authenticated can claim email work';
  assert not has_table_privilege('authenticated','public.announcements','INSERT'), 'authenticated can bypass announcement audit RPC';
  assert position('MEETING_BOOKING_ROLE_REQUIRED' in pg_get_functiondef('public.enforce_meeting_booking_role()'::regprocedure))>0,
    'legacy meeting inserts are not guarded';
  assert position('key_requests' in pg_get_functiondef('public.prevent_legacy_key_overlap_with_baseline()'::regprocedure))>0,
    'legacy key workflow does not check baseline requests';
  assert position('starts_at' in pg_get_functiondef('public.consume_key_request_action(text,text)'::regprocedure))>0,
    'return token does not guard pre-start returns';
  assert position('PROCESSING' in pg_get_functiondef('public.claim_notification_outbox(text,integer)'::regprocedure))>0,
    'outbox claim has no processing-lease recovery';

  assert exists(select 1 from information_schema.views where table_schema='public' and table_name='key_request_history_compat_v'),
    'legacy compatibility view missing';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='room_keys'), 'room_keys was removed';
  assert exists(select 1 from pg_tables where schemaname='public' and tablename='key_loans'), 'key_loans was removed';
end $$;

rollback;
