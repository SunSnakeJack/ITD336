-- Requirements V2: RLS, sanitized Guest access, reports, and supporting indexes.
alter table public.external_parties enable row level security;

drop view if exists public.user_booking_history_v;
drop view if exists public.staff_pending_bookings_v;
drop view if exists public.booking_details_v;
drop view if exists public.key_current_status_v;
drop view if exists public.active_key_loans_v;

create policy "admins read external parties" on public.external_parties for select to authenticated
 using(public.has_permission('BOOKING_CREATE_FOR_OTHERS'));
create policy "admins create external parties" on public.external_parties for insert to authenticated
 with check(public.has_permission('BOOKING_CREATE_FOR_OTHERS') and created_by=auth.uid());
create policy "admins update external parties" on public.external_parties for update to authenticated
 using(public.has_permission('BOOKING_CREATE_FOR_OTHERS'))
 with check(public.has_permission('BOOKING_CREATE_FOR_OTHERS'));

drop policy if exists "read own bookings or booking staff" on public.bookings;
create policy "read own bookings or booking managers" on public.bookings for select to authenticated
 using(requester_id=auth.uid() or beneficiary_user_id=auth.uid() or public.has_permission('BOOKING_READ_ALL'));

drop policy if exists "read own approval history or booking staff" on public.booking_approvals;
create policy "read related approval history or booking managers" on public.booking_approvals for select to authenticated
 using(exists(select 1 from public.bookings b where b.id=booking_id and (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid() or public.has_permission('BOOKING_READ_ALL'))));
drop policy if exists "read own booking history or booking staff" on public.booking_status_history;
create policy "read related booking history or booking managers" on public.booking_status_history for select to authenticated
 using(exists(select 1 from public.bookings b where b.id=booking_id and (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid() or public.has_permission('BOOKING_READ_ALL'))));

drop policy if exists "read own loans or key staff" on public.key_loans;
create policy "read own loans or key managers" on public.key_loans for select to authenticated
 using(borrower_id=auth.uid() or requested_by=auth.uid() or public.has_permission('KEY_MANAGE'));
drop policy if exists "read own loan history or key staff" on public.key_loan_history;
create policy "read related loan history or key managers" on public.key_loan_history for select to authenticated
 using(exists(select 1 from public.key_loans l where l.id=key_loan_id and (l.borrower_id=auth.uid() or l.requested_by=auth.uid() or public.has_permission('KEY_MANAGE'))));

drop policy if exists "authenticated read key inventory" on public.room_keys;
create policy "authenticated read tracked key inventory" on public.room_keys for select to authenticated
 using((active and tracking_mode='TRACKED') or public.has_permission('KEY_MANAGE'));

create view public.booking_details_v with (security_invoker=true) as
select b.*,r.code room_code,r.name room_name,
 coalesce(beneficiary.full_name,external_person.full_name,requester.full_name) room_user_name,
 requester.full_name requester_name,creator.full_name created_by_name
from public.bookings b join public.rooms r on r.id=b.room_id
join public.profiles requester on requester.id=b.requester_id
left join public.profiles beneficiary on beneficiary.id=b.beneficiary_user_id
left join public.profiles creator on creator.id=b.created_by
left join public.external_parties external_person on external_person.id=b.external_party_id;

create view public.key_current_status_v with (security_invoker=true) as
select k.id,k.key_code,k.room_id,r.code room_code,r.name room_name,k.status,k.active,k.tracking_mode,
 l.id active_loan_id,l.borrower_id,l.checked_out_at,l.expected_return_at,l.usage_source,l.user_reported_return_at
from public.room_keys k join public.rooms r on r.id=k.room_id
left join public.key_loans l on l.key_id=k.id and l.status in ('CHECKED_OUT','LATE','RETURN_REPORTED');

create view public.active_key_loans_v with (security_invoker=true) as
select l.*,k.key_code,r.code room_code,r.name room_name
from public.key_loans l left join public.room_keys k on k.id=l.key_id
join public.rooms r on r.id=l.room_id
where l.status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED');

create view public.user_booking_history_v with (security_invoker=true) as select * from public.booking_details_v;
create view public.staff_pending_bookings_v with (security_invoker=true) as select * from public.booking_details_v where status='PENDING';

create or replace view public.room_current_status_v with (security_invoker=true) as
select r.id,r.code,r.name,r.capacity,r.booking_enabled,r.active,
 case when not r.active or not r.booking_enabled then 'UNAVAILABLE' else 'AVAILABLE' end base_status,
 count(k.id) filter(where k.status='AVAILABLE' and k.tracking_mode='TRACKED') available_key_count
from public.rooms r left join public.room_keys k on k.room_id=r.id and k.active group by r.id;

create view public.operational_room_summary_v with (security_invoker=false,security_barrier=true) as
select r.id room_id,r.code room_code,r.name room_name,r.capacity,
 count(k.id) filter(where k.active and k.tracking_mode='TRACKED' and k.status='AVAILABLE') available_key_count,
 exists(select 1 from public.bookings b where b.room_id=r.id and b.status in ('APPROVED','IN_USE') and now()>=b.starts_at and now()<b.ends_at) occupied_by_booking,
 exists(select 1 from public.class_schedules s where s.room_id=r.id and s.active and s.status='ACTIVE' and now()>=s.starts_at and now()<s.ends_at) occupied_by_schedule
from public.rooms r left join public.room_keys k on k.room_id=r.id
where r.active group by r.id;

create view public.booking_report_v with (security_invoker=true) as
select b.id,b.booking_code,b.room_id,r.code room_code,b.requester_id,b.beneficiary_user_id,b.external_party_id,
 b.starts_at,b.ends_at,b.status,b.created_at,b.superseded_by_booking_id,b.override_reason
from public.bookings b join public.rooms r on r.id=b.room_id;

create view public.key_loan_report_v with (security_invoker=true) as
select l.id,l.room_id,r.code room_code,l.key_id,k.key_code,l.borrower_id,l.usage_source,l.status,
 l.checked_out_at,l.expected_return_at,l.user_reported_return_at,l.returned_at,
 (l.expected_return_at is not null and coalesce(l.user_reported_return_at,l.returned_at,now())>l.expected_return_at
  and l.status in ('CHECKED_OUT','LATE','RETURN_REPORTED')) overdue
from public.key_loans l join public.rooms r on r.id=l.room_id left join public.room_keys k on k.id=l.key_id;

create or replace function public.list_public_room_availability(p_starts_at timestamptz,p_ends_at timestamptz)
returns table(room_id uuid,room_code text,room_name text,capacity integer,available boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_open time;v_close time;v_start_local timestamp;v_end_local timestamp;v_within_rules boolean;
begin
 if p_ends_at<=p_starts_at or p_starts_at<now() then raise exception 'INVALID_TIME_RANGE'; end if;
 select (rule_value#>>'{}')::time into v_open from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and active;
 select (rule_value#>>'{}')::time into v_close from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active;
 v_open:=coalesce(v_open,'08:30'::time);v_close:=coalesce(v_close,'17:30'::time);
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok';v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 v_within_rules:=v_start_local::date=v_end_local::date and v_start_local::time>=v_open and v_end_local::time<=v_close;
 return query select r.id,r.code,r.name,r.capacity,
  v_within_rules and not exists(select 1 from public.check_room_availability(r.id,p_starts_at,p_ends_at) c where not c.available)
 from public.rooms r where r.active and r.booking_enabled order by r.name;
end $$;

drop index if exists public.one_active_key_request_per_booking;
create unique index one_active_key_request_per_booking on public.key_loans(booking_id)
 where booking_id is not null and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED');
drop index if exists public.one_active_loan_per_key;
create unique index one_active_loan_per_key on public.key_loans(key_id)
 where key_id is not null and status in ('CHECKED_OUT','LATE','RETURN_REPORTED');
create index bookings_beneficiary_start_idx on public.bookings(beneficiary_user_id,starts_at desc) where beneficiary_user_id is not null;
create index bookings_external_party_idx on public.bookings(external_party_id) where external_party_id is not null;
create index bookings_superseded_by_idx on public.bookings(superseded_by_booking_id) where superseded_by_booking_id is not null;
create index class_schedules_type_status_time_idx on public.class_schedules(room_id,schedule_type,status,starts_at,ends_at) where active;
create index key_loans_room_time_idx on public.key_loans(room_id,checked_out_at desc);
create index key_loans_schedule_idx on public.key_loans(class_schedule_id) where class_schedule_id is not null;
create index room_keys_tracking_status_idx on public.room_keys(room_id,tracking_mode,status) where active;

grant select on public.external_parties,public.booking_details_v,public.key_current_status_v,public.active_key_loans_v,
 public.user_booking_history_v,public.staff_pending_bookings_v,public.operational_room_summary_v,
 public.booking_report_v,public.key_loan_report_v to authenticated;
grant insert,update on public.external_parties to authenticated;
revoke all on function public.list_public_room_availability(timestamptz,timestamptz) from public;
grant execute on function public.list_public_room_availability(timestamptz,timestamptz) to anon,authenticated;
