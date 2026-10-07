create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.account_status as enum ('ACTIVE','SUSPENDED','INACTIVE');
create type public.booking_status as enum ('PENDING','APPROVED','REJECTED','CANCELLED','IN_USE','COMPLETED','NO_SHOW');
create type public.approval_action as enum ('APPROVED','REJECTED');
create type public.key_status as enum ('AVAILABLE','RESERVED','CHECKED_OUT','LOST','DAMAGED','INACTIVE');
create type public.key_loan_status as enum ('REQUESTED','APPROVED','REJECTED','CHECKED_OUT','RETURNED','LATE','LOST','DAMAGED','CANCELLED');
create type public.incident_type as enum ('LOST','DAMAGED','LATE_RETURN','OTHER');
create type public.incident_status as enum ('OPEN','UNDER_REVIEW','AWAITING_PAYMENT','RESOLVED','CANCELLED');
create type public.compensation_status as enum ('PENDING','ASSESSED','PAID','WAIVED','CANCELLED');
create type public.delivery_channel as enum ('EMAIL','IN_APP');
create type public.delivery_status as enum ('PENDING','SENT','FAILED');

create table public.organizations (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 organization_type text not null default 'UNIVERSITY', active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.roles (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 description text, system_role boolean not null default false, created_at timestamptz not null default now()
);
create table public.permissions (
 id uuid primary key default gen_random_uuid(), code text not null unique, description text,
 created_at timestamptz not null default now()
);
create table public.role_permissions (
 role_id uuid not null references public.roles(id) on delete cascade,
 permission_id uuid not null references public.permissions(id) on delete cascade,
 created_at timestamptz not null default now(), primary key (role_id, permission_id)
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '',
 email text not null, university_id text unique, phone text,
 organization_id uuid references public.organizations(id) on delete set null,
 account_status public.account_status not null default 'ACTIVE',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid not null references public.profiles(id) on delete cascade,
 role_id uuid not null references public.roles(id) on delete cascade,
 assigned_by uuid references public.profiles(id) on delete set null,
 assigned_at timestamptz not null default now(), primary key (user_id, role_id)
);

create table public.room_types (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 description text, active boolean not null default true, created_at timestamptz not null default now()
);
create table public.rooms (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 room_type_id uuid not null references public.room_types(id), building text, floor text,
 location_description text, capacity integer not null check (capacity > 0), description text,
 booking_enabled boolean not null default true, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.equipment (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 description text, created_at timestamptz not null default now()
);
create table public.room_equipment (
 room_id uuid not null references public.rooms(id) on delete cascade,
 equipment_id uuid not null references public.equipment(id), quantity integer not null default 1 check (quantity > 0),
 notes text, primary key (room_id, equipment_id)
);

create table public.class_schedules (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id),
 teacher_id uuid references public.profiles(id), course_code text not null, subject_name text not null,
 semester text not null, academic_year text not null, starts_at timestamptz not null, ends_at timestamptz not null,
 recurrence_rule text, recurrence_until date, active boolean not null default true,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 constraint class_schedule_valid_range check (ends_at > starts_at)
);
create table public.room_blocks (
 id uuid primary key default gen_random_uuid(), room_id uuid not null references public.rooms(id),
 starts_at timestamptz not null, ends_at timestamptz not null, reason text not null,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 constraint room_block_valid_range check (ends_at > starts_at)
);
create table public.room_operating_hours (
 id uuid primary key default gen_random_uuid(), room_id uuid references public.rooms(id) on delete cascade,
 day_of_week smallint not null check (day_of_week between 0 and 6), opens_at time not null, closes_at time not null,
 active boolean not null default true, check (closes_at > opens_at), unique nulls not distinct (room_id, day_of_week)
);

create sequence public.booking_code_seq;
create table public.bookings (
 id uuid primary key default gen_random_uuid(), booking_code text not null unique default ('B' || to_char(current_date,'YYYYMMDD') || '-' || lpad(nextval('public.booking_code_seq')::text,6,'0')),
 requester_id uuid not null references public.profiles(id), room_id uuid not null references public.rooms(id),
 starts_at timestamptz not null, ends_at timestamptz not null, purpose text not null, notes text,
 status public.booking_status not null default 'PENDING', requires_key boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 cancelled_at timestamptz, cancelled_by uuid references public.profiles(id), cancel_reason text,
 constraint booking_valid_range check (ends_at > starts_at),
 constraint booking_cancel_fields check ((status <> 'CANCELLED') or (cancelled_at is not null and cancelled_by is not null and nullif(btrim(cancel_reason),'') is not null))
);
alter table public.bookings add constraint no_overlapping_active_bookings exclude using gist
 (room_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
 where (status in ('APPROVED','IN_USE'));
create table public.booking_approvals (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
 action public.approval_action not null, approver_id uuid not null references public.profiles(id),
 reason text, created_at timestamptz not null default now(),
 check (action <> 'REJECTED' or nullif(btrim(reason),'') is not null)
);
create table public.booking_status_history (
 id bigint generated always as identity primary key, booking_id uuid not null references public.bookings(id),
 previous_status public.booking_status, new_status public.booking_status not null,
 changed_by uuid references public.profiles(id), reason text, created_at timestamptz not null default now()
);

create table public.room_keys (
 id uuid primary key default gen_random_uuid(), key_code text not null unique,
 room_id uuid not null references public.rooms(id), status public.key_status not null default 'AVAILABLE',
 notes text, active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.key_loans (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id),
 key_id uuid references public.room_keys(id), borrower_id uuid not null references public.profiles(id),
 status public.key_loan_status not null default 'REQUESTED', requested_at timestamptz not null default now(),
 approved_at timestamptz, approved_by uuid references public.profiles(id), checked_out_at timestamptz,
 checked_out_by uuid references public.profiles(id), expected_return_at timestamptz,
 returned_at timestamptz, returned_to uuid references public.profiles(id), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_active_key_request_per_booking on public.key_loans(booking_id)
 where status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE');
create unique index one_active_loan_per_key on public.key_loans(key_id)
 where key_id is not null and status in ('CHECKED_OUT','LATE');
create table public.key_loan_history (
 id bigint generated always as identity primary key, key_loan_id uuid not null references public.key_loans(id),
 previous_status public.key_loan_status, new_status public.key_loan_status not null,
 changed_by uuid references public.profiles(id), notes text, created_at timestamptz not null default now()
);
create table public.key_incidents (
 id uuid primary key default gen_random_uuid(), key_id uuid not null references public.room_keys(id),
 key_loan_id uuid references public.key_loans(id), reported_by uuid not null references public.profiles(id),
 responsible_user_id uuid references public.profiles(id), incident_type public.incident_type not null,
 description text not null, reported_at timestamptz not null default now(), status public.incident_status not null default 'OPEN',
 resolved_at timestamptz, resolution_notes text
);
create table public.key_compensations (
 id uuid primary key default gen_random_uuid(), incident_id uuid not null references public.key_incidents(id),
 amount numeric(12,2) check (amount >= 0), currency char(3) not null default 'THB',
 status public.compensation_status not null default 'PENDING', paid_at timestamptz,
 recorded_by uuid references public.profiles(id), notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (status <> 'PAID' or paid_at is not null)
);

create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 type text not null, title text not null, message text not null, related_entity_type text,
 related_entity_id uuid, read_at timestamptz, created_at timestamptz not null default now()
);
create table public.notification_deliveries (
 id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications(id) on delete cascade,
 channel public.delivery_channel not null, status public.delivery_status not null default 'PENDING',
 sent_at timestamptz, error_message text, created_at timestamptz not null default now(), unique(notification_id, channel)
);
create table public.booking_rules (
 id uuid primary key default gen_random_uuid(), rule_key text not null unique, rule_value jsonb not null,
 description text, active boolean not null default true, updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table public.system_settings (
 setting_key text primary key, setting_value jsonb not null, description text,
 updated_by uuid references public.profiles(id), updated_at timestamptz not null default now()
);
create table public.holidays (
 id uuid primary key default gen_random_uuid(), holiday_date date not null unique, name text not null,
 booking_allowed boolean not null default false, notes text
);
create table public.audit_logs (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
 action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['organizations','profiles','rooms','room_keys','key_loans','key_compensations'] loop
 execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
end loop; end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
