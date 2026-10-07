create view public.room_current_status_v with (security_invoker=true) as
select r.id,r.code,r.name,r.capacity,r.booking_enabled,r.active,
 case when not r.active or not r.booking_enabled then 'UNAVAILABLE' else 'AVAILABLE' end as base_status,
 count(k.id) filter(where k.status='AVAILABLE') as available_key_count
from public.rooms r left join public.room_keys k on k.room_id=r.id and k.active group by r.id;

create view public.booking_details_v with (security_invoker=true) as
select b.*,r.code room_code,r.name room_name,p.full_name requester_name
from public.bookings b join public.rooms r on r.id=b.room_id join public.profiles p on p.id=b.requester_id;
create view public.key_current_status_v with (security_invoker=true) as
select k.id,k.key_code,k.room_id,r.code room_code,r.name room_name,k.status,k.active,
 l.id active_loan_id,l.borrower_id,l.checked_out_at,l.expected_return_at
from public.room_keys k join public.rooms r on r.id=k.room_id
left join public.key_loans l on l.key_id=k.id and l.status in ('CHECKED_OUT','LATE');
create view public.active_key_loans_v with (security_invoker=true) as
select l.*,k.key_code,r.code room_code,r.name room_name from public.key_loans l
left join public.room_keys k on k.id=l.key_id join public.bookings b on b.id=l.booking_id join public.rooms r on r.id=b.room_id
where l.status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE');
create view public.user_booking_history_v with (security_invoker=true) as select * from public.booking_details_v;
create view public.staff_pending_bookings_v with (security_invoker=true) as select * from public.booking_details_v where status='PENDING';

do $$ declare t text; begin foreach t in array array[
 'organizations','roles','permissions','role_permissions','profiles','user_roles','room_types','rooms','equipment','room_equipment',
 'class_schedules','room_blocks','room_operating_hours','bookings','booking_approvals','booking_status_history','room_keys','key_loans',
 'key_loan_history','key_incidents','key_compensations','notifications','notification_deliveries','booking_rules','system_settings','holidays','audit_logs'
] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy "authenticated read organizations" on public.organizations for select to authenticated using(active or public.has_permission('USER_MANAGE'));
create policy "authenticated read role catalog" on public.roles for select to authenticated using(true);
create policy "authenticated read permission catalog" on public.permissions for select to authenticated using(true);
create policy "read role permissions" on public.role_permissions for select to authenticated using(true);
create policy "read own roles or user managers" on public.user_roles for select to authenticated using(user_id=auth.uid() or public.has_permission('USER_MANAGE'));
create policy "read own profile or user managers" on public.profiles for select to authenticated using(id=auth.uid() or public.has_permission('USER_MANAGE'));
create policy "update safe own profile fields" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

create policy "authenticated read room types" on public.room_types for select to authenticated using(active or public.has_permission('ROOM_MANAGE'));
create policy "authenticated read active rooms" on public.rooms for select to authenticated using(active or public.has_permission('ROOM_MANAGE'));
create policy "room managers insert rooms" on public.rooms for insert to authenticated with check(public.has_permission('ROOM_MANAGE'));
create policy "room managers update rooms" on public.rooms for update to authenticated using(public.has_permission('ROOM_MANAGE')) with check(public.has_permission('ROOM_MANAGE'));
create policy "authenticated read equipment" on public.equipment for select to authenticated using(true);
create policy "authenticated read room equipment" on public.room_equipment for select to authenticated using(true);
create policy "room managers maintain room equipment" on public.room_equipment for all to authenticated using(public.has_permission('ROOM_MANAGE')) with check(public.has_permission('ROOM_MANAGE'));
create policy "authenticated read schedules" on public.class_schedules for select to authenticated using(active or public.has_permission('SCHEDULE_MANAGE'));
create policy "schedule managers maintain schedules" on public.class_schedules for all to authenticated using(public.has_permission('SCHEDULE_MANAGE')) with check(public.has_permission('SCHEDULE_MANAGE'));
create policy "authenticated read room blocks" on public.room_blocks for select to authenticated using(true);
create policy "schedule managers maintain blocks" on public.room_blocks for all to authenticated using(public.has_permission('SCHEDULE_MANAGE')) with check(public.has_permission('SCHEDULE_MANAGE'));
create policy "authenticated read operating hours" on public.room_operating_hours for select to authenticated using(true);
create policy "schedule managers maintain hours" on public.room_operating_hours for all to authenticated using(public.has_permission('SCHEDULE_MANAGE')) with check(public.has_permission('SCHEDULE_MANAGE'));

create policy "read own bookings or booking staff" on public.bookings for select to authenticated using(requester_id=auth.uid() or public.has_permission('BOOKING_READ_ALL'));
create policy "read own approval history or booking staff" on public.booking_approvals for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and (b.requester_id=auth.uid() or public.has_permission('BOOKING_READ_ALL'))));
create policy "read own booking history or booking staff" on public.booking_status_history for select to authenticated using(exists(select 1 from public.bookings b where b.id=booking_id and (b.requester_id=auth.uid() or public.has_permission('BOOKING_READ_ALL'))));

create policy "authenticated read key inventory" on public.room_keys for select to authenticated using(active or public.has_permission('KEY_MANAGE'));
create policy "key managers maintain key inventory" on public.room_keys for all to authenticated using(public.has_permission('KEY_MANAGE')) with check(public.has_permission('KEY_MANAGE'));
create policy "read own loans or key staff" on public.key_loans for select to authenticated using(borrower_id=auth.uid() or public.has_permission('KEY_MANAGE'));
create policy "read own loan history or key staff" on public.key_loan_history for select to authenticated using(exists(select 1 from public.key_loans l where l.id=key_loan_id and (l.borrower_id=auth.uid() or public.has_permission('KEY_MANAGE'))));
create policy "key managers read incidents" on public.key_incidents for select to authenticated using(public.has_permission('KEY_MANAGE') or responsible_user_id=auth.uid());
create policy "key managers maintain incidents" on public.key_incidents for all to authenticated using(public.has_permission('KEY_MANAGE')) with check(public.has_permission('KEY_MANAGE'));
create policy "key managers read compensation" on public.key_compensations for select to authenticated using(public.has_permission('KEY_MANAGE') or exists(select 1 from public.key_incidents i where i.id=incident_id and i.responsible_user_id=auth.uid()));
create policy "key managers maintain compensation" on public.key_compensations for all to authenticated using(public.has_permission('KEY_MANAGE')) with check(public.has_permission('KEY_MANAGE'));

create policy "users read own notifications" on public.notifications for select to authenticated using(user_id=auth.uid());
create policy "users mark own notifications" on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "users read own deliveries" on public.notification_deliveries for select to authenticated using(exists(select 1 from public.notifications n where n.id=notification_id and n.user_id=auth.uid()));
create policy "authenticated read booking rules" on public.booking_rules for select to authenticated using(active or public.has_permission('SETTINGS_MANAGE'));
create policy "settings managers maintain rules" on public.booking_rules for all to authenticated using(public.has_permission('SETTINGS_MANAGE')) with check(public.has_permission('SETTINGS_MANAGE'));
create policy "authenticated read safe settings" on public.system_settings for select to authenticated using(public.has_permission('SETTINGS_MANAGE'));
create policy "settings managers maintain settings" on public.system_settings for all to authenticated using(public.has_permission('SETTINGS_MANAGE')) with check(public.has_permission('SETTINGS_MANAGE'));
create policy "authenticated read holidays" on public.holidays for select to authenticated using(true);
create policy "settings managers maintain holidays" on public.holidays for all to authenticated using(public.has_permission('SETTINGS_MANAGE')) with check(public.has_permission('SETTINGS_MANAGE'));
create policy "audit readers only" on public.audit_logs for select to authenticated using(public.has_permission('AUDIT_READ'));

revoke insert,update,delete on public.bookings,public.booking_approvals,public.booking_status_history,public.key_loans,public.key_loan_history,public.notifications,public.notification_deliveries,public.audit_logs from authenticated,anon;
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant update(full_name,university_id,phone) on public.profiles to authenticated;
grant insert,update,delete on public.rooms,public.room_equipment,public.class_schedules,public.room_blocks,public.room_operating_hours,public.room_keys,public.key_incidents,public.key_compensations,public.booking_rules,public.system_settings,public.holidays to authenticated;

create index bookings_requester_start_idx on public.bookings(requester_id,starts_at desc);
create index bookings_room_time_idx on public.bookings(room_id,starts_at,ends_at);
create index bookings_status_start_idx on public.bookings(status,starts_at);
create index class_schedules_room_time_idx on public.class_schedules(room_id,starts_at,ends_at) where active;
create index room_blocks_room_time_idx on public.room_blocks(room_id,starts_at,ends_at);
create index room_keys_room_status_idx on public.room_keys(room_id,status) where active;
create index key_loans_borrower_status_idx on public.key_loans(borrower_id,status);
create index key_loans_booking_idx on public.key_loans(booking_id);
create index key_loans_key_idx on public.key_loans(key_id) where key_id is not null;
create index notifications_user_unread_idx on public.notifications(user_id,created_at desc) where read_at is null;
create index audit_actor_time_idx on public.audit_logs(actor_id,created_at desc);
create index audit_entity_time_idx on public.audit_logs(entity_type,entity_id,created_at desc);
