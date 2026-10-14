-- Requirements V2: additive schema, safe backfills, and least-privilege RBAC.
alter type public.booking_status add value if not exists 'SUPERSEDED';
alter type public.key_loan_status add value if not exists 'RETURN_REPORTED';

create type public.booking_policy as enum ('AUTO_CONFIRM','MANUAL_APPROVAL');
create type public.key_usage_source as enum ('BOOKING','CLASS_SCHEDULE','DIRECT_USAGE');
create type public.key_tracking_mode as enum ('TRACKED','EXCLUDED_PERMANENT');
create type public.schedule_type as enum ('CLASS','ADMIN_ALLOCATION');
create type public.schedule_status as enum ('ACTIVE','CANCELLED','COMPLETED');

create table public.external_parties (
 id uuid primary key default gen_random_uuid(),
 full_name text not null check (nullif(btrim(full_name),'') is not null),
 organization_name text,
 contact_reference text,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create trigger set_external_parties_updated_at before update on public.external_parties
for each row execute function public.set_updated_at();

alter table public.profiles
 add column identity_provider text,
 add column identity_subject text,
 add column identity_verified_at timestamptz;
create unique index profiles_identity_subject_uidx
 on public.profiles(identity_provider,identity_subject)
 where identity_provider is not null and identity_subject is not null;

alter table public.room_types
 add column booking_policy public.booking_policy not null default 'AUTO_CONFIRM',
 add column student_booking_allowed boolean not null default true;
update public.room_types set booking_policy='MANUAL_APPROVAL'
 where code in ('STUDIO','GAMING','ELEARNING');
update public.room_types set student_booking_allowed=false where code='COLD';

alter table public.class_schedules
 alter column course_code drop not null,
 alter column subject_name drop not null,
 add column schedule_type public.schedule_type not null default 'CLASS',
 add column title text,
 add column status public.schedule_status not null default 'ACTIVE',
 add column responsible_user_id uuid references public.profiles(id),
 add column effective_from date,
 add column effective_until date,
 add constraint class_schedules_type_fields_check check (
  (schedule_type='CLASS' and nullif(btrim(course_code),'') is not null and nullif(btrim(subject_name),'') is not null)
  or (schedule_type='ADMIN_ALLOCATION' and nullif(btrim(title),'') is not null)
 ),
 add constraint class_schedules_effective_range_check check (
  effective_until is null or effective_from is null or effective_until>=effective_from
 );
update public.class_schedules set effective_from=(starts_at at time zone 'Asia/Bangkok')::date
 where effective_from is null;

alter table public.bookings
 add column created_by uuid references public.profiles(id),
 add column beneficiary_user_id uuid references public.profiles(id),
 add column external_party_id uuid references public.external_parties(id),
 add column is_priority boolean not null default false,
 add column superseded_by_booking_id uuid references public.bookings(id),
 add column override_reason text,
 add constraint bookings_beneficiary_check check (
  not (beneficiary_user_id is not null and external_party_id is not null)
 );
update public.bookings set created_by=requester_id,beneficiary_user_id=requester_id
 where created_by is null or beneficiary_user_id is null;
alter table public.bookings alter column created_by set not null;

alter table public.room_keys
 add column tracking_mode public.key_tracking_mode not null default 'TRACKED',
 add column permanent_custodian_id uuid references public.profiles(id),
 add constraint room_keys_tracking_mode_check check (
  (tracking_mode='TRACKED' and permanent_custodian_id is null)
  or tracking_mode='EXCLUDED_PERMANENT'
 );

alter table public.key_loans
 alter column booking_id drop not null,
 add column room_id uuid references public.rooms(id),
 add column usage_source public.key_usage_source not null default 'BOOKING',
 add column class_schedule_id uuid references public.class_schedules(id),
 add column requested_by uuid references public.profiles(id),
 add column authorized_by uuid references public.profiles(id),
 add column user_reported_return_at timestamptz,
 add column return_confirmed_by uuid references public.profiles(id),
 add column physically_verified_at timestamptz,
 add column physically_verified_by uuid references public.profiles(id);
update public.key_loans l set room_id=b.room_id,requested_by=l.borrower_id
 from public.bookings b where b.id=l.booking_id and (l.room_id is null or l.requested_by is null);
alter table public.key_loans
 alter column room_id set not null,
 alter column requested_by set not null,
 add constraint key_loans_usage_source_check check (
  (usage_source='BOOKING' and booking_id is not null and class_schedule_id is null)
  or (usage_source='CLASS_SCHEDULE' and booking_id is null and class_schedule_id is not null)
  or (usage_source='DIRECT_USAGE' and booking_id is null and class_schedule_id is null and authorized_by is not null)
 ),
 add constraint key_loans_return_evidence_check check (
  (user_reported_return_at is null and return_confirmed_by is null)
  or (user_reported_return_at is not null and return_confirmed_by is not null)
 ),
 add constraint key_loans_physical_verification_check check (
  (physically_verified_at is null and physically_verified_by is null)
  or (physically_verified_at is not null and physically_verified_by is not null)
 );

insert into public.roles(code,name,description,system_role) values
 ('ADMIN','Administrator','Administrative management role',true),
 ('PRIORITY_USER','Priority User','Booking override authority without Admin access',true)
on conflict(code) do update set name=excluded.name,description=excluded.description;

insert into public.permissions(code,description) values
 ('ROOM_READ_ALL','Read room operational data'),
 ('SCHEDULE_READ_ALL','Read operational schedules'),
 ('OCCUPANCY_READ','Read sanitized occupancy summaries'),
 ('BOOKING_OVERRIDE','Transactionally supersede an ordinary booking'),
 ('KEY_DIRECT_USE','Borrow a tracked key for authorized direct usage'),
 ('BOOKING_CREATE_FOR_OTHERS','Create a booking for another or external person')
on conflict(code) do update set description=excluded.description;

delete from public.role_permissions rp using public.roles r
 where rp.role_id=r.id and r.code='STAFF';
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p
 on p.code in ('ROOM_READ_ALL','SCHEDULE_READ_ALL','OCCUPANCY_READ','REPORT_READ')
where r.code='STAFF' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='ADMIN' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.code='BOOKING_OVERRIDE'
where r.code='PRIORITY_USER' on conflict do nothing;

insert into public.booking_rules(rule_key,rule_value,description) values
 ('MAX_ADVANCE_BOOKING_DAYS','3','Confirmed V2 limit; implemented as a rolling exact-duration window pending calendar-day confirmation'),
 ('GENERAL_OPEN_TIME','"08:30"','Confirmed V2 local opening time in Asia/Bangkok'),
 ('GENERAL_CLOSE_TIME','"17:30"','Confirmed V2 local closing time in Asia/Bangkok'),
 ('ADVANCE_BOOKING_INTERPRETATION','"EXACT_DURATION"','Engineering implementation; PENDING_BUSINESS_DECISION: confirm calendar days vs exact duration')
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description,active=true,updated_at=now();
