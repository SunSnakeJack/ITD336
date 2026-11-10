-- ITD336 consolidated staging baseline
-- Empty database only. Sources: migrations 0001-0047.
-- Reference data is inserted after 0005; demo auth users and identities are excluded.
-- Apply only after explicit approval and verified Staging project reference.

-- Each source migration runs in its own transaction. This is required for enum additions.

begin;
-- BEGIN SOURCE: 0001_schema.sql
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
-- END SOURCE: 0001_schema.sql
commit;

begin;
-- BEGIN SOURCE: 0002_functions.sql
create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
  select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id
  join public.permissions p on p.id=rp.permission_id join public.profiles pr on pr.id=ur.user_id
  where ur.user_id=auth.uid() and p.code=p_permission and pr.account_status='ACTIVE'
 )
$$;

create or replace function public.check_room_availability(p_room_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_exclude_booking_id uuid default null)
returns table(available boolean, conflict_type text, conflict_id uuid, conflict_description text)
language plpgsql stable security definer set search_path = '' as $$
begin
 if p_ends_at <= p_starts_at then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 return query
 with conflicts as (
  select 'BOOKING'::text kind,
   case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.id else null::uuid end,
   case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.booking_code else 'Existing booking' end description
  from public.bookings b
   where b.room_id=p_room_id and b.status in ('APPROVED','IN_USE') and b.id is distinct from p_exclude_booking_id
   and tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
  union all select 'CLASS_SCHEDULE',c.id,c.course_code||' - '||c.subject_name from public.class_schedules c
   where c.room_id=p_room_id and c.active and tstzrange(c.starts_at,c.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
  union all select 'ROOM_BLOCK',rb.id,rb.reason from public.room_blocks rb
   where rb.room_id=p_room_id and tstzrange(rb.starts_at,rb.ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)')
 )
 select false,kind,id,description from conflicts
 union all select true,null::text,null::uuid,null::text where not exists(select 1 from conflicts);
end $$;

create or replace function public.list_available_rooms(p_starts_at timestamptz,p_ends_at timestamptz)
returns setof public.rooms language sql stable security definer set search_path = '' as $$
 select r.* from public.rooms r where r.active and r.booking_enabled and not exists(
  select 1 from public.check_room_availability(r.id,p_starts_at,p_ends_at) a where not a.available
 ) order by r.name
$$;

create or replace function public.write_audit(p_actor uuid,p_action text,p_entity_type text,p_entity_id uuid,p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(p_actor,p_action,p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb))
$$;
revoke all on function public.write_audit(uuid,text,text,uuid,jsonb) from public, anon, authenticated;

create or replace function public.create_notification(p_user uuid,p_type text,p_title text,p_message text,p_entity_type text,p_entity_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 insert into public.notifications(user_id,type,title,message,related_entity_type,related_entity_id)
 values(p_user,p_type,p_title,p_message,p_entity_type,p_entity_id) returning id into v_id;
 insert into public.notification_deliveries(notification_id,channel) values(v_id,'IN_APP'),(v_id,'EMAIL');
 return v_id;
end $$;
revoke all on function public.create_notification(uuid,text,text,text,text,uuid) from public, anon, authenticated;

create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
begin
 if v_user is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED' using errcode='22023'; end if;
 select * into v_room from public.rooms where id=p_room_id and active for share;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 if not v_room.booking_enabled then raise exception 'ROOM_BOOKING_DISABLED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 insert into public.bookings(requester_id,room_id,starts_at,ends_at,purpose,requires_key,notes)
 values(v_user,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,'PENDING',v_user,'Booking submitted');
 perform public.write_audit(v_user,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id));
 perform public.create_notification(v_user,'BOOKING_SUBMITTED','Booking submitted','Your booking '||v_booking.booking_code||' is pending approval.','booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.approve_booking(p_booking_id uuid,p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings;
begin
 if not public.has_permission('BOOKING_APPROVE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.status<>'PENDING' then raise exception 'INVALID_BOOKING_TRANSITION'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_booking.room_id::text,0));
 if exists(select 1 from public.check_room_availability(v_booking.room_id,v_booking.starts_at,v_booking.ends_at,v_booking.id) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 update public.bookings set status='APPROVED' where id=p_booking_id;
 insert into public.booking_approvals(booking_id,action,approver_id,reason) values(p_booking_id,'APPROVED',v_actor,p_reason);
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,'PENDING','APPROVED',v_actor,p_reason);
 perform public.create_notification(v_booking.requester_id,'BOOKING_APPROVED','Booking approved','Your booking '||v_booking.booking_code||' was approved.','booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_APPROVED','booking',p_booking_id,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('id',p_booking_id,'status','APPROVED');
end $$;

create or replace function public.reject_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings;
begin
 if not public.has_permission('BOOKING_APPROVE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.status<>'PENDING' then raise exception 'INVALID_BOOKING_TRANSITION'; end if;
 update public.bookings set status='REJECTED' where id=p_booking_id;
 insert into public.booking_approvals(booking_id,action,approver_id,reason) values(p_booking_id,'REJECTED',v_actor,btrim(p_reason));
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,'PENDING','REJECTED',v_actor,btrim(p_reason));
 perform public.create_notification(v_booking.requester_id,'BOOKING_REJECTED','Booking rejected','Your booking '||v_booking.booking_code||' was rejected: '||btrim(p_reason),'booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_REJECTED','booking',p_booking_id,jsonb_build_object('reason',btrim(p_reason)));
 return jsonb_build_object('id',p_booking_id,'status','REJECTED');
end $$;

create or replace function public.cancel_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.requester_id<>v_actor and not public.has_permission('BOOKING_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_booking.status not in ('PENDING','APPROVED') then raise exception 'INVALID_BOOKING_TRANSITION'; end if;
 update public.bookings set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason=btrim(p_reason) where id=p_booking_id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,v_booking.status,'CANCELLED',v_actor,btrim(p_reason));
 perform public.create_notification(v_booking.requester_id,'BOOKING_CANCELLED','Booking cancelled','Booking '||v_booking.booking_code||' was cancelled.','booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_CANCELLED','booking',p_booking_id,jsonb_build_object('reason',btrim(p_reason)));
 return jsonb_build_object('id',p_booking_id,'status','CANCELLED');
end $$;

create or replace function public.request_key(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_booking public.bookings; v_loan public.key_loans;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for share;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.requester_id<>v_actor and not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_booking.status<>'APPROVED' or not v_booking.requires_key then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY'; end if;
 if not exists(select 1 from public.room_keys where room_id=v_booking.room_id and active) then raise exception 'NO_KEYS_CONFIGURED'; end if;
 insert into public.key_loans(booking_id,borrower_id) values(p_booking_id,v_booking.requester_id) returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'REQUESTED',v_actor,'Key requested');
 perform public.write_audit(v_actor,'KEY_REQUESTED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));
 return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';
end $$;

create or replace function public.approve_key_request(p_key_loan_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans;
begin
 if not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
 if v_loan.status<>'REQUESTED' then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
 update public.key_loans set status='APPROVED',approved_at=now(),approved_by=v_actor,notes=coalesce(p_notes,notes) where id=p_key_loan_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,'REQUESTED','APPROVED',v_actor,p_notes);
 perform public.create_notification(v_loan.borrower_id,'KEY_REQUEST_APPROVED','Key request approved','Your key request was approved.','key_loan',p_key_loan_id);
 perform public.write_audit(v_actor,'KEY_REQUEST_APPROVED','key_loan',p_key_loan_id,'{}'::jsonb);
 return jsonb_build_object('id',p_key_loan_id,'status','APPROVED');
end $$;

create or replace function public.checkout_key(p_key_loan_id uuid,p_key_id uuid,p_expected_return_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans; v_key public.room_keys; v_booking public.bookings;
begin
 if not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_expected_return_at<=now() then raise exception 'INVALID_EXPECTED_RETURN'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found or v_loan.status<>'APPROVED' then raise exception 'INVALID_KEY_LOAN'; end if;
 select * into v_booking from public.bookings where id=v_loan.booking_id;
 select * into v_key from public.room_keys where id=p_key_id for update;
 if not found or v_key.status<>'AVAILABLE' or not v_key.active then raise exception 'KEY_NOT_AVAILABLE'; end if;
 if v_key.room_id<>v_booking.room_id then raise exception 'KEY_ROOM_MISMATCH'; end if;
 update public.room_keys set status='CHECKED_OUT' where id=p_key_id;
 update public.key_loans set key_id=p_key_id,status='CHECKED_OUT',checked_out_at=now(),checked_out_by=v_actor,expected_return_at=p_expected_return_at where id=p_key_loan_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,'APPROVED','CHECKED_OUT',v_actor,'Key '||v_key.key_code||' checked out');
 perform public.write_audit(v_actor,'KEY_CHECKED_OUT','key_loan',p_key_loan_id,jsonb_build_object('key_id',p_key_id));
 return jsonb_build_object('id',p_key_loan_id,'status','CHECKED_OUT','key_id',p_key_id);
end $$;

create or replace function public.return_key(p_key_loan_id uuid,p_condition text default 'NORMAL',p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans; v_status public.key_loan_status; v_key_status public.key_status; v_incident public.incident_type;
begin
 if not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if upper(p_condition) not in ('NORMAL','DAMAGED','LOST') then raise exception 'INVALID_KEY_CONDITION'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found or v_loan.status not in ('CHECKED_OUT','LATE') or v_loan.key_id is null then raise exception 'INVALID_KEY_LOAN'; end if;
 perform 1 from public.room_keys where id=v_loan.key_id for update;
 if upper(p_condition)='LOST' then v_status:='LOST'; v_key_status:='LOST'; v_incident:='LOST';
 elsif upper(p_condition)='DAMAGED' then v_status:='DAMAGED'; v_key_status:='DAMAGED'; v_incident:='DAMAGED';
 elsif now()>v_loan.expected_return_at then v_status:='LATE'; v_key_status:='AVAILABLE'; v_incident:='LATE_RETURN';
 else v_status:='RETURNED'; v_key_status:='AVAILABLE'; end if;
 update public.key_loans set status=v_status,returned_at=now(),returned_to=v_actor,notes=coalesce(p_notes,notes) where id=p_key_loan_id;
 update public.room_keys set status=v_key_status where id=v_loan.key_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,v_loan.status,v_status,v_actor,p_notes);
 if v_incident is not null then insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
  values(v_loan.key_id,p_key_loan_id,v_actor,v_loan.borrower_id,v_incident,coalesce(nullif(p_notes,''),v_incident::text||' recorded during return')); end if;
 perform public.create_notification(v_loan.borrower_id,'KEY_RETURNED','Key return recorded','Your key return was recorded as '||v_status::text||'.','key_loan',p_key_loan_id);
 perform public.write_audit(v_actor,case when v_status='LOST' then 'KEY_MARKED_LOST' when v_status='DAMAGED' then 'KEY_MARKED_DAMAGED' else 'KEY_RETURNED' end,'key_loan',p_key_loan_id,jsonb_build_object('condition',p_condition,'status',v_status));
 return jsonb_build_object('id',p_key_loan_id,'status',v_status,'key_status',v_key_status);
end $$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security invoker set search_path = '' as $$
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=auth.uid()
$$;

revoke all on function public.has_permission(text) from public,anon;
grant execute on function public.has_permission(text) to authenticated;
revoke all on function public.check_room_availability(uuid,timestamptz,timestamptz,uuid), public.list_available_rooms(timestamptz,timestamptz), public.create_booking(uuid,timestamptz,timestamptz,text,boolean,text), public.approve_booking(uuid,text), public.reject_booking(uuid,text), public.cancel_booking(uuid,text), public.request_key(uuid), public.approve_key_request(uuid,text), public.checkout_key(uuid,uuid,timestamptz), public.return_key(uuid,text,text), public.mark_notification_read(uuid) from public,anon;
grant execute on function public.check_room_availability(uuid,timestamptz,timestamptz,uuid), public.list_available_rooms(timestamptz,timestamptz), public.create_booking(uuid,timestamptz,timestamptz,text,boolean,text), public.approve_booking(uuid,text), public.reject_booking(uuid,text), public.cancel_booking(uuid,text), public.request_key(uuid), public.approve_key_request(uuid,text), public.checkout_key(uuid,uuid,timestamptz), public.return_key(uuid,text,text), public.mark_notification_read(uuid) to authenticated;
-- END SOURCE: 0002_functions.sql
commit;

begin;
-- BEGIN SOURCE: 0003_rls_views_indexes.sql
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
-- END SOURCE: 0003_rls_views_indexes.sql
commit;

begin;
-- BEGIN SOURCE: 0004_verify_foundation.sql
-- Non-destructive deployment assertions for the ITD336 database foundation.
-- A failed assertion rolls back this migration and identifies schema drift.
do $$
declare
  v_actual integer;
  v_missing text;
  v_expected_tables constant text[] := array[
    'organizations','roles','permissions','role_permissions','profiles','user_roles',
    'room_types','rooms','equipment','room_equipment','class_schedules','room_blocks',
    'room_operating_hours','bookings','booking_approvals','booking_status_history',
    'room_keys','key_loans','key_loan_history','key_incidents','key_compensations',
    'notifications','notification_deliveries','booking_rules','system_settings','holidays','audit_logs'
  ];
  v_expected_views constant text[] := array[
    'room_current_status_v','booking_details_v','key_current_status_v',
    'active_key_loans_v','user_booking_history_v','staff_pending_bookings_v'
  ];
  v_expected_functions constant text[] := array[
    'set_updated_at','handle_new_user','has_permission','check_room_availability',
    'list_available_rooms','write_audit','create_notification','create_booking',
    'approve_booking','reject_booking','cancel_booking','request_key',
    'approve_key_request','checkout_key','return_key','mark_notification_read'
  ];
begin
  select count(*) into v_actual from pg_catalog.pg_tables where schemaname = 'public';
  if v_actual <> 27 then raise exception 'Expected 27 public tables, found %', v_actual; end if;

  select string_agg(expected, ', ' order by expected) into v_missing
  from unnest(v_expected_tables) expected
  where not exists (
    select 1 from pg_catalog.pg_tables t where t.schemaname = 'public' and t.tablename = expected
  );
  if v_missing is not null then raise exception 'Missing tables: %', v_missing; end if;

  select count(*) into v_actual from pg_catalog.pg_views where schemaname = 'public';
  if v_actual <> 6 then raise exception 'Expected 6 public views, found %', v_actual; end if;

  select string_agg(expected, ', ' order by expected) into v_missing
  from unnest(v_expected_views) expected
  where not exists (
    select 1 from pg_catalog.pg_views v where v.schemaname = 'public' and v.viewname = expected
  );
  if v_missing is not null then raise exception 'Missing views: %', v_missing; end if;

  select string_agg(expected, ', ' order by expected) into v_missing
  from unnest(v_expected_functions) expected
  where not exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = expected
  );
  if v_missing is not null then raise exception 'Missing functions: %', v_missing; end if;

  select count(*) into v_actual
  from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, array[]::text[])) c where c like 'search_path=%');
  if v_actual <> 0 then raise exception '% SECURITY DEFINER functions lack a fixed search_path', v_actual; end if;

  select count(*) into v_actual
  from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity;
  if v_actual <> 27 then raise exception 'Expected RLS on 27 public tables, found %', v_actual; end if;

  select count(*) into v_actual from pg_catalog.pg_policies where schemaname = 'public';
  if v_actual <> 41 then raise exception 'Expected 41 public RLS policies, found %', v_actual; end if;

  if has_table_privilege('anon', 'public.bookings', 'SELECT,INSERT,UPDATE,DELETE')
    or has_table_privilege('anon', 'public.audit_logs', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'anon has unexpected privileges on sensitive tables';
  end if;
  if has_table_privilege('authenticated', 'public.bookings', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.booking_approvals', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.booking_status_history', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.key_loans', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.key_loan_history', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.audit_logs', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated has direct mutation privileges on RPC-controlled tables';
  end if;
  if has_table_privilege('authenticated', 'public.user_roles', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated', 'public.role_permissions', 'INSERT,UPDATE,DELETE') then
    raise exception 'authenticated can elevate roles or permissions directly';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint where conname = 'no_overlapping_active_bookings' and contype = 'x'
  ) then raise exception 'Booking overlap exclusion constraint is missing'; end if;
  if not exists (
    select 1 from pg_catalog.pg_indexes where schemaname = 'public' and indexname = 'one_active_key_request_per_booking'
  ) or not exists (
    select 1 from pg_catalog.pg_indexes where schemaname = 'public' and indexname = 'one_active_loan_per_key'
  ) then raise exception 'Active key-loan uniqueness indexes are missing'; end if;

end
$$;
-- END SOURCE: 0004_verify_foundation.sql
commit;

begin;
-- BEGIN SOURCE: 0005_v2_schema_rbac.sql
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
-- END SOURCE: 0005_v2_schema_rbac.sql

-- BEGIN REFERENCE SEED (NO AUTH/DEMO USERS)
-- Development reference data only. Auth users must be created through Supabase Auth.
insert into public.organizations(code,name,organization_type) values ('NBU','North Bangkok University','UNIVERSITY') on conflict(code) do nothing;
insert into public.roles(code,name,description,system_role) values
 ('STUDENT','Student','Current student',true),('TEACHER','Teacher','Teaching staff',true),
 ('STAFF','Staff','Read-only building and housekeeping personnel',true),
 ('ADMIN','Administrator','Administrative management role',true),
 ('PRIORITY_USER','Priority User','Booking override authority without Admin access',true)
on conflict(code) do update set name=excluded.name,description=excluded.description;
insert into public.permissions(code,description) values
 ('ROOM_MANAGE','Create and update rooms and equipment'),('SCHEDULE_MANAGE','Manage schedules and room blocks'),
 ('BOOKING_READ_ALL','Read all bookings'),('BOOKING_APPROVE','Approve or reject bookings'),('BOOKING_MANAGE','Manage any booking'),
 ('KEY_MANAGE','Manage key inventory and loans'),('USER_MANAGE','Manage application users and roles'),
 ('SETTINGS_MANAGE','Manage rules/settings'),('AUDIT_READ','Read audit history'),('REPORT_READ','Read operational reports'),
 ('ROOM_READ_ALL','Read room operational data'),('SCHEDULE_READ_ALL','Read operational schedules'),
 ('OCCUPANCY_READ','Read sanitized occupancy summaries'),('BOOKING_OVERRIDE','Transactionally supersede an ordinary booking'),
 ('KEY_DIRECT_USE','Borrow a tracked key for authorized direct usage'),
 ('BOOKING_CREATE_FOR_OTHERS','Create a booking for another or external person')
on conflict(code) do update set description=excluded.description;
delete from public.role_permissions rp using public.roles r where rp.role_id=r.id and r.code='STAFF';
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.code in ('ROOM_READ_ALL','SCHEDULE_READ_ALL','OCCUPANCY_READ','REPORT_READ')
where r.code='STAFF' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code='ADMIN'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.code='BOOKING_OVERRIDE'
where r.code='PRIORITY_USER' on conflict do nothing;

insert into public.room_types(code,name,booking_policy,student_booking_allowed) values
 ('COMPUTER','Computer Room','AUTO_CONFIRM',true),('STUDIO','Studio Room','MANUAL_APPROVAL',true),
 ('GAMING','Gaming Room','MANUAL_APPROVAL',true),('ELEARNING','E-Learning Room','MANUAL_APPROVAL',true),
 ('MEETING','Meeting Room','AUTO_CONFIRM',true),('COLD','Cold Room','AUTO_CONFIRM',false),
 ('CLASSROOM','Classroom','MANUAL_APPROVAL',true)
on conflict(code) do update set booking_policy=excluded.booking_policy,student_booking_allowed=excluded.student_booking_allowed;
insert into public.rooms(code,name,room_type_id,building,floor,capacity,description)
select v.code,v.name,rt.id,'อาคารคณะเทคโนโลยีสารสนเทศ',v.floor,v.capacity,'Development seed room aligned with the ITD floor map'
from (values ('S2407','ห้องปฏิบัติการ S2407','COMPUTER','4',40),('S2408','ห้องปฏิบัติการ S2408','COMPUTER','4',40),
 ('S2409','ห้องปฏิบัติการ S2409','COMPUTER','4',40),('S2410','ห้องปฏิบัติการ S2410','COMPUTER','4',40),
 ('S2411','ห้องปฏิบัติการ S2411','COMPUTER','4',40),('S2412','ห้องปฏิบัติการ S2412','COMPUTER','4',40),
 ('STUDIO','Studio','STUDIO','4.5',25),('ESPORT','E-sport','GAMING','3.5',30),
 ('ELEARNING','E-learning','ELEARNING','4',40),('MEET-FACULTY','ห้องประชุมคณะ','MEETING','4',20),
 ('2401','ห้องเรียน 2401','CLASSROOM','4',40),('2402','ห้องเรียน 2402','CLASSROOM','4',40),
 ('2403','ห้องเรียน 2403','CLASSROOM','4',40),('2404','ห้องเรียน 2404','CLASSROOM','4',40),
 ('2405','ห้องเรียน 2405','CLASSROOM','4',40),('2406','ห้องเรียน 2406','CLASSROOM','4',40)) v(code,name,type_code,floor,capacity)
join public.room_types rt on rt.code=v.type_code on conflict(code) do nothing;
insert into public.equipment(code,name) values
 ('PROJECTOR','Projector'),('COMPUTER','Computer'),('MICROPHONE','Microphone'),('CAMERA','Camera'),('SMART_TV','Smart TV'),('WHITEBOARD','Whiteboard')
on conflict(code) do nothing;
insert into public.room_equipment(room_id,equipment_id,quantity)
select r.id,e.id,case when r.code like 'S24%' and e.code='COMPUTER' then 40 else 1 end
from public.rooms r join public.equipment e on
 (r.code like 'S24%' and e.code in ('COMPUTER','PROJECTOR','WHITEBOARD')) or
 (r.code='STUDIO' and e.code in ('CAMERA','MICROPHONE','SMART_TV')) or
 (r.code in ('ELEARNING','MEET-FACULTY') and e.code in ('PROJECTOR','WHITEBOARD'))
on conflict do nothing;
insert into public.room_keys(key_code,room_id)
select v.key_code,r.id from (values ('KEY-STUDIO-001','STUDIO'),('KEY-STUDIO-002','STUDIO'),('KEY-STUDIO-003','STUDIO'),('KEY-MEET-001','MEET-FACULTY')) v(key_code,room_code)
join public.rooms r on r.code=v.room_code on conflict(key_code) do nothing;
insert into public.booking_rules(rule_key,rule_value,description) values
 ('MAX_ADVANCE_BOOKING_DAYS','3','Confirmed V2 limit; implemented as rolling exact duration pending calendar-day confirmation'),
 ('MAX_BOOKINGS_PER_DAY','3','PROVISIONAL development default'),
 ('ALLOW_WEEKEND_BOOKING','true','PROVISIONAL for Sunday; Saturday is closed through CLOSED_WEEKDAYS'),
 ('CLOSED_WEEKDAYS','[6]','Confirmed weekly closure; PostgreSQL day 6 is Saturday'),
 ('ALLOW_EXTERNAL_USERS','false','PROVISIONAL; external workflow not active'),
 ('AUTO_APPROVE_TEACHER_CLASS','false','PROVISIONAL pending policy confirmation'),
 ('CANCEL_BEFORE_MINUTES','60','PROVISIONAL development default'),
 ('KEY_RETURN_GRACE_MINUTES','15','PROVISIONAL development default'),
 ('BOOKING_DEFAULT_DURATION','60','PROVISIONAL duration in minutes'),
 ('HISTORY_RETENTION_DAYS','2555','PROVISIONAL development default'),
 ('GENERAL_OPEN_TIME','"08:30"','Confirmed V2 local opening time in Asia/Bangkok'),
 ('GENERAL_CLOSE_TIME','"18:30"','Confirmed local closing time; permits the final 17:30-18:30 slot in Asia/Bangkok'),
 ('ADVANCE_BOOKING_INTERPRETATION','"EXACT_DURATION"','PENDING_BUSINESS_DECISION: confirm calendar days vs exact duration')
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description;
insert into public.system_settings(setting_key,setting_value,description) values
 ('DISPLAY_TIMEZONE','"Asia/Bangkok"','Display timezone; persisted timestamps remain timestamptz')
on conflict(setting_key) do update set setting_value=excluded.setting_value;
-- END REFERENCE SEED
commit;

begin;
-- BEGIN SOURCE: 0006_v2_workflow_functions.sql
-- Requirements V2: trusted booking, override, key-borrowing, and return workflows.
create or replace function public.has_role(p_role text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
  join public.profiles p on p.id=ur.user_id
  where ur.user_id=auth.uid() and r.code=p_role and p.account_status='ACTIVE'
 )
$$;

create or replace function public.check_room_availability(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_exclude_booking_id uuid default null)
returns table(available boolean,conflict_type text,conflict_id uuid,conflict_description text)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 return query
 with conflicts as (
  select 'BOOKING'::text kind,
   case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.id else null::uuid end id,
   case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.booking_code else 'Existing booking' end description
  from public.bookings b where b.room_id=p_room_id and b.status in ('APPROVED','IN_USE')
   and b.id is distinct from p_exclude_booking_id
   and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
  union all
  select case when c.schedule_type='CLASS' then 'CLASS_SCHEDULE' else 'ADMIN_SCHEDULE' end,
   case when public.has_permission('SCHEDULE_READ_ALL') then c.id else null::uuid end,
   case when public.has_permission('SCHEDULE_READ_ALL') then coalesce(c.title,c.course_code||' - '||c.subject_name) else 'Protected schedule' end
  from public.class_schedules c where c.room_id=p_room_id and c.active and c.status='ACTIVE'
   and tstzrange(c.starts_at,c.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
  union all
  select 'ROOM_BLOCK',case when public.has_permission('SCHEDULE_READ_ALL') then rb.id else null::uuid end,
   case when public.has_permission('SCHEDULE_READ_ALL') then rb.reason else 'Room unavailable' end
  from public.room_blocks rb where rb.room_id=p_room_id
   and tstzrange(rb.starts_at,rb.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
 )
 select false,kind,id,description from conflicts
 union all select true,null::text,null::uuid,null::text where not exists(select 1 from conflicts);
end $$;

create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
 v_policy public.booking_policy; v_student_allowed boolean; v_status public.booking_status;
 v_max_days integer; v_open time; v_close time; v_start_local timestamp; v_end_local timestamp;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not (public.has_role('STUDENT') or public.has_role('TEACHER') or public.has_role('ADMIN')) then raise exception 'BOOKING_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED' using errcode='22023'; end if;
 select r.* into v_room from public.rooms r where r.id=p_room_id and r.active for share;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select rt.booking_policy,rt.student_booking_allowed into v_policy,v_student_allowed from public.room_types rt where rt.id=v_room.room_type_id;
 if not v_room.booking_enabled then raise exception 'ROOM_BOOKING_DISABLED'; end if;
 select (rule_value#>>'{}')::integer into v_max_days from public.booking_rules where rule_key='MAX_ADVANCE_BOOKING_DAYS' and active;
 select (rule_value#>>'{}')::time into v_open from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and active;
 select (rule_value#>>'{}')::time into v_close from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active;
 v_max_days:=coalesce(v_max_days,3); v_open:=coalesce(v_open,'08:30'::time); v_close:=coalesce(v_close,'17:30'::time);
 if p_starts_at>now()+make_interval(days=>v_max_days) then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok'; v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 if v_start_local::date<>v_end_local::date or v_start_local::time<v_open or v_end_local::time>v_close then
  raise exception 'OUTSIDE_OPERATING_HOURS';
 end if;
 if not v_student_allowed and not (public.has_role('TEACHER') or public.has_role('ADMIN')) then
  raise exception 'COLD_ROOM_TEACHER_OR_ADMIN_ONLY' using errcode='42501';
 end if;
 v_status:=case when v_policy='MANUAL_APPROVAL' then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then
  raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';
 end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,requires_key,notes,status)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes,v_status)
 returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason)
 values(v_booking.id,v_status,v_actor,case when v_status='APPROVED' then 'Automatically confirmed by room policy' else 'Manual approval required by room policy' end);
 perform public.write_audit(v_actor,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id,'policy',v_policy,'status',v_status));
 perform public.create_notification(v_actor,case when v_status='APPROVED' then 'BOOKING_CONFIRMED' else 'BOOKING_SUBMITTED' end,
  case when v_status='APPROVED' then 'Booking confirmed' else 'Booking submitted' end,
  'Booking '||v_booking.booking_code||case when v_status='APPROVED' then ' is confirmed.' else ' is pending approval.' end,'booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.create_external_booking(p_external_name text,p_organization_name text,p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_party uuid; v_booking public.bookings; v_room public.rooms;
begin
 if not public.has_permission('BOOKING_CREATE_FOR_OTHERS') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_external_name),'') is null or nullif(btrim(p_reason),'') is null then raise exception 'EXTERNAL_PERSON_AND_REASON_REQUIRED'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE'; end if;
 select * into v_room from public.rooms where id=p_room_id and active and booking_enabled for share;
 if not found then raise exception 'ROOM_NOT_AVAILABLE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE'; end if;
 insert into public.external_parties(full_name,organization_name,created_by) values(btrim(p_external_name),nullif(btrim(p_organization_name),''),v_actor) returning id into v_party;
 insert into public.bookings(requester_id,created_by,external_party_id,room_id,starts_at,ends_at,purpose,status,notes)
 values(v_actor,v_actor,v_party,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),'APPROVED',p_reason) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,'APPROVED',v_actor,'Admin-created external booking: '||btrim(p_reason));
 perform public.write_audit(v_actor,'EXTERNAL_BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('external_party_id',v_party,'reason',btrim(p_reason)));
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status,'external_party_id',v_party);
end $$;

create or replace function public.override_booking(p_existing_booking_id uuid,p_purpose text,p_reason text,p_requires_key boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_old public.bookings; v_new public.bookings;
begin
 if not public.has_permission('BOOKING_OVERRIDE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'OVERRIDE_REASON_REQUIRED'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED'; end if;
 select * into v_old from public.bookings where id=p_existing_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_old.status<>'APPROVED' or v_old.is_priority then raise exception 'ONLY_APPROVED_NON_PRIORITY_BOOKING_CAN_BE_OVERRIDDEN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_old.room_id::text,0));
 if exists(select 1 from public.check_room_availability(v_old.room_id,v_old.starts_at,v_old.ends_at,v_old.id) where not available) then
  raise exception 'PROTECTED_OR_ADDITIONAL_CONFLICT_PREVENTS_OVERRIDE';
 end if;
 update public.bookings set status='SUPERSEDED',override_reason=btrim(p_reason) where id=v_old.id;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,status,requires_key,is_priority,notes)
 values(v_actor,v_actor,v_actor,v_old.room_id,v_old.starts_at,v_old.ends_at,btrim(p_purpose),'APPROVED',coalesce(p_requires_key,false),true,'Priority override of '||v_old.booking_code)
 returning * into v_new;
 update public.bookings set superseded_by_booking_id=v_new.id where id=v_old.id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason)
 values(v_old.id,v_old.status,'SUPERSEDED',v_actor,btrim(p_reason)),(v_new.id,null,'APPROVED',v_actor,'Priority booking override');
 perform public.create_notification(v_old.requester_id,'BOOKING_SUPERSEDED','Booking replaced','Booking '||v_old.booking_code||' was replaced by an authorized priority booking.','booking',v_old.id);
 perform public.write_audit(v_actor,'BOOKING_OVERRIDDEN','booking',v_new.id,jsonb_build_object('superseded_booking_id',v_old.id,'reason',btrim(p_reason)));
 return jsonb_build_object('id',v_new.id,'booking_code',v_new.booking_code,'status',v_new.status,'superseded_booking_id',v_old.id);
end $$;

create or replace function public.request_key(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;v_loan public.key_loans;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 select * into v_booking from public.bookings where id=p_booking_id for share;
 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor and not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_booking.status<>'APPROVED' or not v_booking.requires_key then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY'; end if;
 if not exists(select 1 from public.room_keys where room_id=v_booking.room_id and active and tracking_mode='TRACKED') then raise exception 'NO_TRACKED_KEYS_CONFIGURED'; end if;
 insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,status)
 values(p_booking_id,v_booking.room_id,'BOOKING',coalesce(v_booking.beneficiary_user_id,v_booking.requester_id),v_actor,'REQUESTED') returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'REQUESTED',v_actor,'Legacy booking key request');
 perform public.write_audit(v_actor,'KEY_REQUESTED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));
 return jsonb_build_object('id',v_loan.id,'status',v_loan.status,'deprecated_workflow',true);
exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';
end $$;

create or replace function public.borrow_key(p_key_id uuid,p_room_id uuid,p_usage_source public.key_usage_source,p_expected_return_at timestamptz,p_booking_id uuid default null,p_class_schedule_id uuid default null,p_borrower_id uuid default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_borrower uuid:=coalesce(p_borrower_id,auth.uid()); v_key public.room_keys; v_booking public.bookings; v_schedule public.class_schedules; v_loan public.key_loans; v_authorizer uuid;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_expected_return_at<=now() then raise exception 'INVALID_EXPECTED_RETURN'; end if;
 if p_usage_source='BOOKING' then
  select * into v_booking from public.bookings where id=p_booking_id and room_id=p_room_id and status in ('APPROVED','IN_USE') for share;
  if not found then raise exception 'VALID_CONFIRMED_BOOKING_REQUIRED'; end if;
  if v_borrower<>v_actor or (v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor and not public.has_permission('KEY_MANAGE')) then raise exception 'FORBIDDEN'; end if;
  if now()<v_booking.starts_at or now()>=v_booking.ends_at or p_expected_return_at>v_booking.ends_at then raise exception 'KEY_USAGE_OUTSIDE_BOOKING_PERIOD'; end if;
  v_authorizer:=v_booking.created_by;
 elsif p_usage_source='CLASS_SCHEDULE' then
  select * into v_schedule from public.class_schedules where id=p_class_schedule_id and room_id=p_room_id and schedule_type='CLASS' and status='ACTIVE' and active for share;
  if not found then raise exception 'VALID_CLASS_SCHEDULE_REQUIRED'; end if;
  if v_schedule.teacher_id<>v_actor and not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN'; end if;
  if now()<v_schedule.starts_at or p_expected_return_at>v_schedule.ends_at then raise exception 'KEY_USAGE_OUTSIDE_CLASS_PERIOD'; end if;
  v_authorizer:=coalesce(v_schedule.teacher_id,v_actor);
 elsif p_usage_source='DIRECT_USAGE' then
  if not (public.has_permission('KEY_DIRECT_USE') or public.has_permission('KEY_MANAGE')) then raise exception 'FORBIDDEN'; end if;
  if v_borrower<>v_actor and not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN'; end if;
  v_authorizer:=v_actor;
 else raise exception 'INVALID_USAGE_SOURCE'; end if;
 select * into v_key from public.room_keys where id=p_key_id for update;
 if not found or v_key.room_id<>p_room_id or not v_key.active or v_key.tracking_mode<>'TRACKED' or v_key.status<>'AVAILABLE' then raise exception 'KEY_NOT_AVAILABLE'; end if;
 update public.room_keys set status='CHECKED_OUT' where id=p_key_id;
 insert into public.key_loans(booking_id,room_id,usage_source,class_schedule_id,key_id,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,checked_out_at,checked_out_by,expected_return_at,notes)
 values(case when p_usage_source='BOOKING' then p_booking_id end,p_room_id,p_usage_source,case when p_usage_source='CLASS_SCHEDULE' then p_class_schedule_id end,p_key_id,v_borrower,v_actor,v_authorizer,'CHECKED_OUT',now(),v_authorizer,now(),v_actor,p_expected_return_at,p_notes)
 returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'CHECKED_OUT',v_actor,'Borrowed via '||p_usage_source::text);
 perform public.write_audit(v_actor,'KEY_BORROWED','key_loan',v_loan.id,jsonb_build_object('source',p_usage_source,'borrower_id',v_borrower,'key_id',p_key_id));
 return jsonb_build_object('id',v_loan.id,'status',v_loan.status,'key_id',p_key_id,'usage_source',p_usage_source);
exception when unique_violation then raise exception 'KEY_ALREADY_HAS_ACTIVE_LOAN';
end $$;

create or replace function public.confirm_key_return(p_key_loan_id uuid,p_reported_return_at timestamptz default now(),p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if p_reported_return_at>now()+interval '5 minutes' then raise exception 'INVALID_REPORTED_RETURN_TIME'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
 if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_loan.status not in ('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
 if p_reported_return_at<v_loan.checked_out_at then raise exception 'RETURN_BEFORE_CHECKOUT'; end if;
 update public.key_loans set status='RETURN_REPORTED',user_reported_return_at=p_reported_return_at,return_confirmed_by=v_actor,notes=coalesce(p_notes,notes) where id=p_key_loan_id;
 update public.room_keys set status='RESERVED' where id=v_loan.key_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
 values(p_key_loan_id,v_loan.status,'RETURN_REPORTED',v_actor,coalesce(p_notes,'User-reported return; physical handover not independently verified'));
 perform public.write_audit(v_actor,'KEY_RETURN_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('reported_return_at',p_reported_return_at,'physical_verification',false));
 return jsonb_build_object('id',p_key_loan_id,'status','RETURN_REPORTED','physically_verified',false);
end $$;

create or replace function public.return_key(p_key_loan_id uuid,p_condition text default 'NORMAL',p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans; v_status public.key_loan_status; v_key_status public.key_status; v_incident public.incident_type; v_return_time timestamptz;
begin
 if not public.has_permission('KEY_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if upper(p_condition) not in ('NORMAL','DAMAGED','LOST') then raise exception 'INVALID_KEY_CONDITION'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found or v_loan.status not in ('CHECKED_OUT','LATE','RETURN_REPORTED') or v_loan.key_id is null then raise exception 'INVALID_KEY_LOAN'; end if;
 perform 1 from public.room_keys where id=v_loan.key_id for update;
 v_return_time:=coalesce(v_loan.user_reported_return_at,now());
 if upper(p_condition)='LOST' then v_status:='LOST';v_key_status:='LOST';v_incident:='LOST';
 elsif upper(p_condition)='DAMAGED' then v_status:='DAMAGED';v_key_status:='DAMAGED';v_incident:='DAMAGED';
 elsif v_return_time>v_loan.expected_return_at then v_status:='LATE';v_key_status:='AVAILABLE';v_incident:='LATE_RETURN';
 else v_status:='RETURNED';v_key_status:='AVAILABLE'; end if;
 update public.key_loans set status=v_status,returned_at=v_return_time,returned_to=v_actor,physically_verified_at=now(),physically_verified_by=v_actor,notes=coalesce(p_notes,notes) where id=p_key_loan_id;
 update public.room_keys set status=v_key_status where id=v_loan.key_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,v_loan.status,v_status,v_actor,p_notes);
 if v_incident is not null then insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
 values(v_loan.key_id,p_key_loan_id,v_actor,v_loan.borrower_id,v_incident,coalesce(nullif(p_notes,''),v_incident::text||' recorded during verification')); end if;
 perform public.create_notification(v_loan.borrower_id,'KEY_RETURN_VERIFIED','Key return verified','Your key return was verified as '||v_status::text||'.','key_loan',p_key_loan_id);
 perform public.write_audit(v_actor,'KEY_RETURN_VERIFIED','key_loan',p_key_loan_id,jsonb_build_object('condition',p_condition,'status',v_status));
 return jsonb_build_object('id',p_key_loan_id,'status',v_status,'key_status',v_key_status,'physically_verified',true);
end $$;

revoke all on function public.has_role(text),public.create_external_booking(text,text,uuid,timestamptz,timestamptz,text,text),public.override_booking(uuid,text,text,boolean),public.borrow_key(uuid,uuid,public.key_usage_source,timestamptz,uuid,uuid,uuid,text),public.confirm_key_return(uuid,timestamptz,text) from public,anon;
grant execute on function public.has_role(text),public.create_external_booking(text,text,uuid,timestamptz,timestamptz,text,text),public.override_booking(uuid,text,text,boolean),public.borrow_key(uuid,uuid,public.key_usage_source,timestamptz,uuid,uuid,uuid,text),public.confirm_key_return(uuid,timestamptz,text) to authenticated;
-- END SOURCE: 0006_v2_workflow_functions.sql
commit;

begin;
-- BEGIN SOURCE: 0007_v2_rls_views_indexes.sql
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
-- END SOURCE: 0007_v2_rls_views_indexes.sql
commit;

begin;
-- BEGIN SOURCE: 0008_academic_schedule_management.sql
-- Admin academic schedule management and a shared, privacy-safe schedule feed.
-- Additive migration: existing schedules and room history remain intact.

alter table public.rooms
 add column academic_schedule_confirmed boolean not null default false,
 add column academic_schedule_confirmed_at timestamptz,
 add column academic_schedule_confirmed_by uuid references public.profiles(id),
 add constraint rooms_schedule_confirmation_check check (
  (not academic_schedule_confirmed and academic_schedule_confirmed_at is null and academic_schedule_confirmed_by is null)
  or (academic_schedule_confirmed and academic_schedule_confirmed_at is not null and academic_schedule_confirmed_by is not null)
 );

alter table public.class_schedules
 add column day_of_week smallint,
 add column start_time time,
 add column end_time time,
 add column updated_at timestamptz not null default now(),
 add column updated_by uuid references public.profiles(id);

update public.class_schedules set
 day_of_week=extract(dow from starts_at at time zone 'Asia/Bangkok')::smallint,
 start_time=(starts_at at time zone 'Asia/Bangkok')::time,
 end_time=(ends_at at time zone 'Asia/Bangkok')::time,
 effective_from=coalesce(effective_from,(starts_at at time zone 'Asia/Bangkok')::date),
 effective_until=coalesce(effective_until,recurrence_until,(starts_at at time zone 'Asia/Bangkok')::date),
 updated_by=created_by;

alter table public.class_schedules
 alter column day_of_week set not null,
 alter column start_time set not null,
 alter column end_time set not null,
 alter column effective_from set not null,
 alter column effective_until set not null,
 add constraint class_schedules_day_check check(day_of_week between 0 and 6),
 add constraint class_schedules_time_check check(end_time>start_time);

create trigger set_class_schedules_updated_at before update on public.class_schedules
for each row execute function public.set_updated_at();

create index class_schedules_recurring_lookup_idx
 on public.class_schedules(room_id,day_of_week,effective_from,effective_until,start_time,end_time)
 where active and status='ACTIVE';

create or replace function public.set_room_schedule_confirmation(p_room_id uuid,p_confirmed boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_before jsonb;
begin
 if not public.has_permission('SCHEDULE_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select to_jsonb(r) into v_before from public.rooms r where r.id=p_room_id for update;
 if v_before is null then raise exception 'ROOM_NOT_FOUND'; end if;
 update public.rooms set academic_schedule_confirmed=p_confirmed,
  academic_schedule_confirmed_at=case when p_confirmed then now() else null end,
  academic_schedule_confirmed_by=case when p_confirmed then v_actor else null end
 where id=p_room_id;
 perform public.write_audit(v_actor,'ROOM_SCHEDULE_CONFIRMATION_CHANGED','room',p_room_id,
  jsonb_build_object('before',v_before,'confirmed',p_confirmed));
end $$;

create or replace function public.upsert_academic_schedule(
 p_schedule_id uuid,p_room_id uuid,p_teacher_id uuid,p_course_code text,p_subject_name text,
 p_academic_year text,p_semester text,p_day_of_week smallint,p_start_time time,p_end_time time,
 p_effective_from date,p_effective_until date
) returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_id uuid; v_before jsonb; v_first_date date; v_start timestamptz; v_end timestamptz;
begin
 if not public.has_permission('SCHEDULE_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_day_of_week not between 0 and 6 or p_end_time<=p_start_time or p_effective_until<p_effective_from then
  raise exception 'INVALID_SCHEDULE_RANGE' using errcode='22007';
 end if;
 if nullif(btrim(p_course_code),'') is null or nullif(btrim(p_subject_name),'') is null
  or nullif(btrim(p_academic_year),'') is null or nullif(btrim(p_semester),'') is null then
  raise exception 'REQUIRED_SCHEDULE_FIELDS_MISSING' using errcode='22023';
 end if;
 if not exists(select 1 from public.rooms where id=p_room_id and active) then raise exception 'ROOM_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,1));

 if exists(
  select 1 from public.class_schedules s where s.room_id=p_room_id and s.active and s.status='ACTIVE'
   and s.id is distinct from p_schedule_id and s.day_of_week=p_day_of_week
   and daterange(s.effective_from,s.effective_until,'[]')&&daterange(p_effective_from,p_effective_until,'[]')
   and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')
    &&tsrange(date '2000-01-01'+p_start_time,date '2000-01-01'+p_end_time,'[)')
 ) then raise exception 'ACADEMIC_SCHEDULE_CONFLICT' using errcode='23P01'; end if;

 v_first_date:=p_effective_from+((p_day_of_week-extract(dow from p_effective_from)::integer+7)%7);
 if exists(
  select 1 from generate_series(v_first_date,p_effective_until,interval '7 days') occurrence(day)
  join public.bookings b on b.room_id=p_room_id and b.status in ('APPROVED','IN_USE')
   and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(
    (occurrence.day::date+p_start_time) at time zone 'Asia/Bangkok',
    (occurrence.day::date+p_end_time) at time zone 'Asia/Bangkok','[)')
 ) then raise exception 'BOOKING_CONFLICT' using errcode='23P01'; end if;

 if exists(
  select 1 from generate_series(v_first_date,p_effective_until,interval '7 days') occurrence(day)
  join public.room_blocks rb on rb.room_id=p_room_id
   and tstzrange(rb.starts_at,rb.ends_at,'[)')&&tstzrange(
    (occurrence.day::date+p_start_time) at time zone 'Asia/Bangkok',
    (occurrence.day::date+p_end_time) at time zone 'Asia/Bangkok','[)')
 ) then raise exception 'ROOM_BLOCK_CONFLICT' using errcode='23P01'; end if;

 v_start:=(v_first_date+p_start_time) at time zone 'Asia/Bangkok';
 v_end:=(v_first_date+p_end_time) at time zone 'Asia/Bangkok';
 if p_schedule_id is null then
  insert into public.class_schedules(
   room_id,teacher_id,course_code,subject_name,semester,academic_year,starts_at,ends_at,
   recurrence_rule,recurrence_until,active,created_by,schedule_type,status,responsible_user_id,
   effective_from,effective_until,day_of_week,start_time,end_time,updated_by
  ) values(
   p_room_id,p_teacher_id,btrim(p_course_code),btrim(p_subject_name),btrim(p_semester),btrim(p_academic_year),v_start,v_end,
   'FREQ=WEEKLY',p_effective_until,true,v_actor,'CLASS','ACTIVE',p_teacher_id,
   p_effective_from,p_effective_until,p_day_of_week,p_start_time,p_end_time,v_actor
  ) returning id into v_id;
  perform public.write_audit(v_actor,'ACADEMIC_SCHEDULE_CREATED','class_schedule',v_id,
   jsonb_build_object('room_id',p_room_id,'course_code',btrim(p_course_code),'effective_from',p_effective_from,'effective_until',p_effective_until));
 else
  select to_jsonb(s) into v_before from public.class_schedules s where s.id=p_schedule_id for update;
  if v_before is null then raise exception 'SCHEDULE_NOT_FOUND'; end if;
  update public.class_schedules set room_id=p_room_id,teacher_id=p_teacher_id,course_code=btrim(p_course_code),
   subject_name=btrim(p_subject_name),semester=btrim(p_semester),academic_year=btrim(p_academic_year),
   starts_at=v_start,ends_at=v_end,recurrence_rule='FREQ=WEEKLY',recurrence_until=p_effective_until,
   active=true,status='ACTIVE',responsible_user_id=p_teacher_id,effective_from=p_effective_from,
   effective_until=p_effective_until,day_of_week=p_day_of_week,start_time=p_start_time,end_time=p_end_time,updated_by=v_actor
  where id=p_schedule_id returning id into v_id;
  perform public.write_audit(v_actor,'ACADEMIC_SCHEDULE_UPDATED','class_schedule',v_id,
   jsonb_build_object('before',v_before,'room_id',p_room_id,'course_code',btrim(p_course_code)));
 end if;
 return v_id;
end $$;

create or replace function public.deactivate_academic_schedule(p_schedule_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_before jsonb;
begin
 if not public.has_permission('SCHEDULE_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED' using errcode='22023'; end if;
 select to_jsonb(s) into v_before from public.class_schedules s where s.id=p_schedule_id for update;
 if v_before is null then raise exception 'SCHEDULE_NOT_FOUND'; end if;
 update public.class_schedules set active=false,status='CANCELLED',updated_by=v_actor where id=p_schedule_id;
 perform public.write_audit(v_actor,'ACADEMIC_SCHEDULE_DEACTIVATED','class_schedule',p_schedule_id,
  jsonb_build_object('before',v_before,'reason',btrim(p_reason)));
end $$;

create or replace function public.get_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 return query
 with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s
  cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where (p_room_id is null or s.room_id=p_room_id) and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 )
 select 'schedule:'||s.id||':'||s.occurrence_date,s.schedule_type::text,
  case when s.schedule_type='CLASS' then coalesce(s.course_code||' · '||s.subject_name,s.title,'ชั้นเรียน') else coalesce(s.title,'รายการใช้ห้อง') end,
  (s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok',(s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok',
  s.id,'CLASS_SCHEDULE',s.status::text from occurrences s
 union all
 select 'booking:'||b.id,'BOOKING',case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.purpose else 'มีการจองห้อง' end,
  b.starts_at,b.ends_at,b.id,'BOOKING',b.status::text from public.bookings b
 where (p_room_id is null or b.room_id=p_room_id) and b.status in ('APPROVED','IN_USE')
  and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 union all
 select 'block:'||rb.id,case when rb.reason ilike '%maintenance%' or rb.reason ilike '%ซ่อม%' then 'MAINTENANCE' else 'BLOCKED' end,
  case when public.has_permission('SCHEDULE_READ_ALL') then rb.reason else 'ห้องไม่พร้อมใช้งาน' end,
  rb.starts_at,rb.ends_at,rb.id,'ROOM_BLOCK','ACTIVE' from public.room_blocks rb
 where (p_room_id is null or rb.room_id=p_room_id) and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok')
  and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 order by starts_at;
end $$;

revoke all on function public.set_room_schedule_confirmation(uuid,boolean),
 public.upsert_academic_schedule(uuid,uuid,uuid,text,text,text,text,smallint,time,time,date,date),
 public.deactivate_academic_schedule(uuid,text),public.get_room_schedule_events(uuid,date,date) from public,anon;
grant execute on function public.set_room_schedule_confirmation(uuid,boolean),
 public.upsert_academic_schedule(uuid,uuid,uuid,text,text,text,text,smallint,time,time,date,date),
 public.deactivate_academic_schedule(uuid,text),public.get_room_schedule_events(uuid,date,date) to authenticated;
-- END SOURCE: 0008_academic_schedule_management.sql
commit;

begin;
-- BEGIN SOURCE: 0009_fix_room_schedule_feed_order.sql
-- Keep applied migration history immutable. Replace only the faulty feed function.
create or replace function public.get_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 return query
 with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s
  cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where (p_room_id is null or s.room_id=p_room_id) and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'schedule:'||s.id||':'||s.occurrence_date event_id,s.schedule_type::text event_kind,
   case when s.schedule_type='CLASS' then coalesce(s.course_code||' · '||s.subject_name,s.title,'ชั้นเรียน') else coalesce(s.title,'รายการใช้ห้อง') end event_title,
   (s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,
   (s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,
   s.id event_source_id,'CLASS_SCHEDULE'::text event_source_type,s.status::text event_status from occurrences s
  union all
  select 'booking:'||b.id,'BOOKING',case when public.has_permission('BOOKING_READ_ALL') or b.requester_id=auth.uid() then b.purpose else 'มีการจองห้อง' end,
   b.starts_at,b.ends_at,b.id,'BOOKING',b.status::text from public.bookings b
  where (p_room_id is null or b.room_id=p_room_id) and b.status in ('APPROVED','IN_USE')
   and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all
  select 'block:'||rb.id,case when rb.reason ilike '%maintenance%' or rb.reason ilike '%ซ่อม%' then 'MAINTENANCE' else 'BLOCKED' end,
   case when public.has_permission('SCHEDULE_READ_ALL') then rb.reason else 'ห้องไม่พร้อมใช้งาน' end,
   rb.starts_at,rb.ends_at,rb.id,'ROOM_BLOCK','ACTIVE' from public.room_blocks rb
  where (p_room_id is null or rb.room_id=p_room_id) and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok')
   and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 )
 select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status
 from events e order by e.event_start;
end $$;

revoke all on function public.get_room_schedule_events(uuid,date,date) from public,anon;
grant execute on function public.get_room_schedule_events(uuid,date,date) to authenticated;
-- END SOURCE: 0009_fix_room_schedule_feed_order.sql
commit;

begin;
-- BEGIN SOURCE: 0010_align_rooms_with_itd_floor_map.sql
-- Align the room catalog with the approved ITD floor-map labels while preserving
-- the six existing room UUIDs and every booking/schedule/key relationship.

update public.rooms set code='S2407',name='ห้องปฏิบัติการ S2407',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4',location_description='ฝั่งห้องปฏิบัติการ ชั้น 4' where code='COLD-102';
update public.rooms set code='S2408',name='ห้องปฏิบัติการ S2408',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4',location_description='ฝั่งห้องปฏิบัติการ ชั้น 4' where code='COMP-101';
update public.rooms set code='STUDIO',name='Studio',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4.5',location_description='ชั้นลอย ใกล้บันได' where code='STUDIO-201';
update public.rooms set code='ESPORT',name='E-sport',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='3.5',location_description='ชั้นลอย ใกล้บันได' where code='GAME-301';
update public.rooms set code='ELEARNING',name='E-learning',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4',location_description='ใกล้บันได ชั้น 4' where code='ELRN-202';
update public.rooms set code='MEET-FACULTY',name='ห้องประชุมคณะ',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4',location_description='ภายในพื้นที่สำนักงานคณะ' where code='MEET-401';

insert into public.rooms(code,name,room_type_id,building,floor,location_description,capacity,description)
select v.code,'ห้องปฏิบัติการ '||v.code,rt.id,'อาคารคณะเทคโนโลยีสารสนเทศ','4','ฝั่งห้องปฏิบัติการ ชั้น 4',40,'ห้องปฏิบัติการคอมพิวเตอร์'
from (values ('S2409'),('S2410'),('S2411'),('S2412')) v(code)
join public.room_types rt on rt.code='COMPUTER'
where not exists(select 1 from public.rooms r where r.code=v.code);
-- END SOURCE: 0010_align_rooms_with_itd_floor_map.sql
commit;

begin;
-- BEGIN SOURCE: 0011_public_room_schedule_api.sql
-- Privacy-safe read API for guests. Anonymous users receive no direct table access.
create or replace function public.get_public_room_catalog()
returns table(
 id uuid,code text,name text,room_type_name text,building text,floor text,
 capacity integer,academic_schedule_confirmed boolean
)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.name,rt.name,r.building,r.floor,r.capacity,r.academic_schedule_confirmed
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 where r.active
 order by r.code
$$;

create or replace function public.get_public_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 if not exists(select 1 from public.rooms r where r.id=p_room_id and r.active) then raise exception 'ROOM_NOT_FOUND'; end if;
 return query
 with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s
  cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'class:'||s.id||':'||s.occurrence_date event_id,'CLASS'::text event_kind,
   coalesce(s.course_code||' · '||s.subject_name,'ตารางเรียน') event_title,
   (s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,
   (s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,
   null::uuid event_source_id,'CLASS_SCHEDULE'::text event_source_type,'ACTIVE'::text event_status from occurrences s
  union all
  select 'booking:'||md5(b.id::text),'BOOKING','มีการจองห้อง',b.starts_at,b.ends_at,null::uuid,'BOOKING',b.status::text
  from public.bookings b where b.room_id=p_room_id and b.status in ('APPROVED','IN_USE')
   and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all
  select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE'
  from public.room_blocks rb where rb.room_id=p_room_id
   and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 )
 select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status
 from events e order by e.event_start;
end $$;

revoke all on function public.get_public_room_catalog(),public.get_public_room_schedule_events(uuid,date,date) from public;
grant execute on function public.get_public_room_catalog(),public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;
-- END SOURCE: 0011_public_room_schedule_api.sql
commit;

begin;
-- BEGIN SOURCE: 0012_admin_room_map_management.sql
-- Complete the floor-map room catalog and centralize room availability changes.

insert into public.room_types(code,name,description,booking_policy,student_booking_allowed)
values ('CLASSROOM','Classroom','General teaching classroom','MANUAL_APPROVAL',true)
on conflict(code) do update set name=excluded.name,description=excluded.description;

insert into public.rooms(code,name,room_type_id,building,floor,location_description,capacity,description)
select v.code,'ห้องเรียน '||v.code,rt.id,'อาคารคณะเทคโนโลยีสารสนเทศ','4','ฝั่งห้องเรียน ชั้น 4',40,'ห้องเรียนทั่วไป'
from (values ('2401'),('2402'),('2403'),('2404'),('2405'),('2406')) v(code)
join public.room_types rt on rt.code='CLASSROOM'
where not exists(select 1 from public.rooms r where r.code=v.code);

create or replace function public.set_room_availability(p_room_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_before jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not public.has_permission('ROOM_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select to_jsonb(r) into v_before from public.rooms r where r.id=p_room_id for update;
 if v_before is null then raise exception 'ROOM_NOT_FOUND' using errcode='P0002'; end if;
 update public.rooms set active=p_active,booking_enabled=p_active where id=p_room_id;
 perform public.write_audit(v_actor,'ROOM_AVAILABILITY_CHANGED','room',p_room_id,
  jsonb_build_object('before',v_before,'active',p_active,'booking_enabled',p_active));
 return p_active;
end $$;

revoke all on function public.set_room_availability(uuid,boolean) from public,anon;
grant execute on function public.set_room_availability(uuid,boolean) to authenticated;
-- END SOURCE: 0012_admin_room_map_management.sql
commit;

begin;
-- BEGIN SOURCE: 0013_public_room_status_and_saturday_holiday.sql
-- Expose room availability safely to guests and enforce the confirmed Saturday holiday.

drop function public.get_public_room_catalog();
create function public.get_public_room_catalog()
returns table(
 id uuid,code text,name text,room_type_name text,building text,floor text,
 capacity integer,active boolean,academic_schedule_confirmed boolean
)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.name,rt.name,r.building,r.floor,r.capacity,r.active,r.academic_schedule_confirmed
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 order by r.code
$$;

revoke all on function public.get_public_room_catalog() from public;
grant execute on function public.get_public_room_catalog() to anon,authenticated;

insert into public.booking_rules(rule_key,rule_value,description)
values ('CLOSED_WEEKDAYS','[6]'::jsonb,'Confirmed weekly closure; PostgreSQL day 6 is Saturday')
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description,active=true;

create or replace function public.reject_closed_weekday_schedule()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.active and new.status='ACTIVE' and new.day_of_week=6 then
  raise exception 'SATURDAY_IS_CLOSED' using errcode='22023';
 end if;
 return new;
end $$;

drop trigger if exists reject_closed_weekday_schedule on public.class_schedules;
create trigger reject_closed_weekday_schedule
before insert or update of day_of_week,active,status on public.class_schedules
for each row execute function public.reject_closed_weekday_schedule();
-- END SOURCE: 0013_public_room_status_and_saturday_holiday.sql
commit;

begin;
-- BEGIN SOURCE: 0014_academic_term_settings.sql
-- Configurable academic terms used as the effective range for recurring classes.

create table public.academic_terms (
 id uuid primary key default gen_random_uuid(),
 academic_year text not null check(nullif(btrim(academic_year),'') is not null),
 term_code text not null check(nullif(btrim(term_code),'') is not null),
 starts_on date not null,
 ends_on date not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint academic_terms_date_check check(ends_on>=starts_on),
 constraint academic_terms_year_code_key unique(academic_year,term_code)
);

create trigger set_academic_terms_updated_at before update on public.academic_terms
for each row execute function public.set_updated_at();

alter table public.academic_terms enable row level security;
create policy "authenticated read academic terms" on public.academic_terms
for select to authenticated using(true);
revoke all on public.academic_terms from anon,authenticated;
grant select on public.academic_terms to authenticated;

create or replace function public.upsert_academic_term(
 p_term_id uuid,p_academic_year text,p_term_code text,p_starts_on date,p_ends_on date,p_active boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_before jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_academic_year),'') is null or nullif(btrim(p_term_code),'') is null or p_ends_on<p_starts_on then
  raise exception 'INVALID_ACADEMIC_TERM' using errcode='22023';
 end if;
 if p_term_id is null then
  insert into public.academic_terms(academic_year,term_code,starts_on,ends_on,active)
  values(btrim(p_academic_year),btrim(p_term_code),p_starts_on,p_ends_on,p_active) returning id into v_id;
  perform public.write_audit(v_actor,'ACADEMIC_TERM_CREATED','academic_term',v_id,
   jsonb_build_object('academic_year',btrim(p_academic_year),'term_code',btrim(p_term_code),'starts_on',p_starts_on,'ends_on',p_ends_on));
 else
  select to_jsonb(t) into v_before from public.academic_terms t where t.id=p_term_id for update;
  if v_before is null then raise exception 'ACADEMIC_TERM_NOT_FOUND' using errcode='P0002'; end if;
  update public.academic_terms set academic_year=btrim(p_academic_year),term_code=btrim(p_term_code),
   starts_on=p_starts_on,ends_on=p_ends_on,active=p_active where id=p_term_id returning id into v_id;
  perform public.write_audit(v_actor,'ACADEMIC_TERM_UPDATED','academic_term',v_id,
   jsonb_build_object('before',v_before,'academic_year',btrim(p_academic_year),'term_code',btrim(p_term_code),'starts_on',p_starts_on,'ends_on',p_ends_on,'active',p_active));
 end if;
 return v_id;
end $$;

revoke all on function public.upsert_academic_term(uuid,text,text,date,date,boolean) from public,anon;
grant execute on function public.upsert_academic_term(uuid,text,text,date,date,boolean) to authenticated;
-- END SOURCE: 0014_academic_term_settings.sql
commit;

begin;
-- BEGIN SOURCE: 0015_academic_schedule_conflict_details.sql
-- Provide authorized, non-sensitive conflict detail for the Admin schedule form.

create or replace function public.find_academic_schedule_conflict(
 p_schedule_id uuid,p_room_id uuid,p_day_of_week smallint,p_start_time time,p_end_time time,
 p_effective_from date,p_effective_until date
) returns table(day_of_week smallint,course_code text,subject_name text,start_time time,end_time time)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not public.has_permission('SCHEDULE_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if p_day_of_week not between 0 and 6 or p_end_time<=p_start_time or p_effective_until<p_effective_from then
  raise exception 'INVALID_SCHEDULE_RANGE' using errcode='22007';
 end if;
 return query
 select s.day_of_week,s.course_code,s.subject_name,s.start_time,s.end_time
 from public.class_schedules s
 where s.room_id=p_room_id and s.active and s.status='ACTIVE'
  and s.id is distinct from p_schedule_id and s.day_of_week=p_day_of_week
  and daterange(s.effective_from,s.effective_until,'[]')&&daterange(p_effective_from,p_effective_until,'[]')
  and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')
   &&tsrange(date '2000-01-01'+p_start_time,date '2000-01-01'+p_end_time,'[)')
 order by s.start_time,s.course_code
 limit 1;
end $$;

revoke all on function public.find_academic_schedule_conflict(uuid,uuid,smallint,time,time,date,date) from public,anon;
grant execute on function public.find_academic_schedule_conflict(uuid,uuid,smallint,time,time,date,date) to authenticated;
-- END SOURCE: 0015_academic_schedule_conflict_details.sql
commit;

begin;
-- BEGIN SOURCE: 0016_admin_room_details.sql
-- Allow room managers to edit the user-facing room name, capacity, and availability
-- through one audited, permission-checked operation.
create or replace function public.update_room_details(
  p_room_id uuid,
  p_name text,
  p_capacity integer,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_before jsonb;
begin
  if v_actor is null or not public.has_permission('ROOM_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'ROOM_NAME_REQUIRED';
  end if;
  if p_capacity < 1 or p_capacity > 1000 then
    raise exception 'INVALID_ROOM_CAPACITY';
  end if;

  select to_jsonb(r) into v_before
  from public.rooms r
  where r.id = p_room_id
  for update;
  if v_before is null then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  update public.rooms
  set name = btrim(p_name),
      capacity = p_capacity,
      active = p_active,
      booking_enabled = p_active
  where id = p_room_id;

  perform public.write_audit(
    v_actor,
    'ROOM_DETAILS_UPDATED',
    'room',
    p_room_id,
    jsonb_build_object(
      'before', v_before,
      'name', btrim(p_name),
      'capacity', p_capacity,
      'active', p_active,
      'booking_enabled', p_active
    )
  );
  return true;
end
$$;

revoke all on function public.update_room_details(uuid, text, integer, boolean) from public, anon;
grant execute on function public.update_room_details(uuid, text, integer, boolean) to authenticated;
-- END SOURCE: 0016_admin_room_details.sql
commit;

begin;
-- BEGIN SOURCE: 0017_external_booking_edit.sql
-- Make exact-time availability checks aware of recurring academic schedules,
-- and allow authorized administrators to edit external-party bookings safely.
create or replace function public.check_room_availability(
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_exclude_booking_id uuid default null
)
returns table(available boolean, conflict_type text, conflict_id uuid, conflict_description text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_ends_at <= p_starts_at then
    raise exception 'INVALID_TIME_RANGE' using errcode = '22007';
  end if;
  return query
  with requested_days as (
    select day::date occurrence_date
    from pg_catalog.generate_series(
      (p_starts_at at time zone 'Asia/Bangkok')::date,
      ((p_ends_at - interval '1 microsecond') at time zone 'Asia/Bangkok')::date,
      interval '1 day'
    ) day
  ), conflicts as (
    select 'BOOKING'::text kind,
      case when public.has_permission('BOOKING_READ_ALL') or b.requester_id = auth.uid() then b.id else null::uuid end conflict_id,
      case when public.has_permission('BOOKING_READ_ALL') or b.requester_id = auth.uid() then b.booking_code else 'Existing booking' end description
    from public.bookings b
    where b.room_id = p_room_id
      and b.status in ('APPROVED', 'IN_USE')
      and b.id is distinct from p_exclude_booking_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
    union all
    select 'CLASS_SCHEDULE', c.id, c.course_code || ' · ' || c.subject_name
    from public.class_schedules c
    join requested_days d
      on d.occurrence_date between c.effective_from and c.effective_until
      and extract(dow from d.occurrence_date)::smallint = c.day_of_week
    where c.room_id = p_room_id
      and c.active
      and c.status = 'ACTIVE'
      and tstzrange(
        (d.occurrence_date + c.start_time) at time zone 'Asia/Bangkok',
        (d.occurrence_date + c.end_time) at time zone 'Asia/Bangkok',
        '[)'
      ) && tstzrange(p_starts_at, p_ends_at, '[)')
    union all
    select 'ROOM_BLOCK', rb.id, rb.reason
    from public.room_blocks rb
    where rb.room_id = p_room_id
      and tstzrange(rb.starts_at, rb.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  )
  select false, c.kind, c.conflict_id, c.description from conflicts c
  union all
  select true, null::text, null::uuid, null::text
  where not exists(select 1 from conflicts);
end
$$;

create or replace function public.get_external_booking_for_edit(p_booking_id uuid)
returns table(booking_id uuid, external_name text, reason text, starts_at timestamptz, ends_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('BOOKING_CREATE_FOR_OTHERS') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select b.id, e.full_name, b.purpose, b.starts_at, b.ends_at
  from public.bookings b
  join public.external_parties e on e.id = b.external_party_id
  where b.id = p_booking_id and b.status = 'APPROVED';
end
$$;

create or replace function public.update_external_booking(
  p_booking_id uuid,
  p_external_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_booking public.bookings;
  v_before jsonb;
begin
  if not public.has_permission('BOOKING_CREATE_FOR_OTHERS') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(btrim(p_external_name), '') is null or nullif(btrim(p_reason), '') is null then
    raise exception 'EXTERNAL_PERSON_AND_REASON_REQUIRED';
  end if;
  if p_ends_at <= p_starts_at or p_starts_at <= now() then
    raise exception 'INVALID_TIME_RANGE';
  end if;
  if (p_starts_at at time zone 'Asia/Bangkok')::date <> (p_ends_at at time zone 'Asia/Bangkok')::date then
    raise exception 'BOOKING_MUST_END_SAME_DAY';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.external_party_id is null then
    raise exception 'EXTERNAL_BOOKING_NOT_FOUND';
  end if;
  if v_booking.status <> 'APPROVED' then
    raise exception 'EXTERNAL_BOOKING_NOT_EDITABLE';
  end if;
  v_before := to_jsonb(v_booking);
  perform pg_advisory_xact_lock(hashtextextended(v_booking.room_id::text, 0));
  if exists(
    select 1 from public.check_room_availability(v_booking.room_id, p_starts_at, p_ends_at, p_booking_id)
    where not available
  ) then
    raise exception 'ROOM_UNAVAILABLE' using errcode = '23P01';
  end if;

  update public.external_parties
  set full_name = btrim(p_external_name)
  where id = v_booking.external_party_id;
  update public.bookings
  set starts_at = p_starts_at, ends_at = p_ends_at, purpose = btrim(p_reason), notes = btrim(p_reason)
  where id = p_booking_id;
  insert into public.booking_status_history(booking_id, previous_status, new_status, changed_by, reason)
  values(p_booking_id, 'APPROVED', 'APPROVED', v_actor, 'External booking details updated');
  perform public.write_audit(
    v_actor,
    'EXTERNAL_BOOKING_UPDATED',
    'booking',
    p_booking_id,
    jsonb_build_object('before', v_before, 'external_name', btrim(p_external_name), 'reason', btrim(p_reason), 'starts_at', p_starts_at, 'ends_at', p_ends_at)
  );
  return jsonb_build_object('id', p_booking_id, 'booking_code', v_booking.booking_code, 'status', 'APPROVED');
end
$$;

revoke all on function public.get_external_booking_for_edit(uuid), public.update_external_booking(uuid, text, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_external_booking_for_edit(uuid), public.update_external_booking(uuid, text, timestamptz, timestamptz, text) to authenticated;
-- END SOURCE: 0017_external_booking_edit.sql
commit;

begin;
-- BEGIN SOURCE: 0018_room_layout_key_and_code_edit.sql
-- Keep floor-plan placement stable while allowing the user-facing room code to change.
alter table public.rooms add column layout_key text;
update public.rooms set layout_key = code where layout_key is null;
alter table public.rooms alter column layout_key set not null;
alter table public.rooms add constraint rooms_layout_key_key unique(layout_key);

drop function public.get_public_room_catalog();
create function public.get_public_room_catalog()
returns table(
 id uuid,code text,layout_key text,name text,room_type_name text,building text,floor text,
 capacity integer,active boolean,academic_schedule_confirmed boolean
)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.layout_key,r.name,rt.name,r.building,r.floor,r.capacity,r.active,r.academic_schedule_confirmed
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 order by r.code
$$;

revoke all on function public.get_public_room_catalog() from public;
grant execute on function public.get_public_room_catalog() to anon,authenticated;

create or replace function public.update_room_details_v2(
  p_room_id uuid,
  p_code text,
  p_name text,
  p_capacity integer,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_code text := upper(btrim(p_code));
  v_before jsonb;
begin
  if v_actor is null or not public.has_permission('ROOM_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(v_code, '') is null or v_code !~ '^[A-Z0-9_-]+$' then
    raise exception 'INVALID_ROOM_CODE';
  end if;
  if exists(select 1 from public.rooms where code = v_code and id <> p_room_id) then
    raise exception 'ROOM_CODE_ALREADY_EXISTS' using errcode = '23505';
  end if;
  if nullif(btrim(p_name), '') is null then
    raise exception 'ROOM_NAME_REQUIRED';
  end if;
  if p_capacity < 1 or p_capacity > 1000 then
    raise exception 'INVALID_ROOM_CAPACITY';
  end if;

  select to_jsonb(r) into v_before from public.rooms r where r.id = p_room_id for update;
  if v_before is null then raise exception 'ROOM_NOT_FOUND'; end if;

  update public.rooms
  set code = v_code,
      name = btrim(p_name),
      capacity = p_capacity,
      active = p_active,
      booking_enabled = p_active
  where id = p_room_id;

  perform public.write_audit(
    v_actor,'ROOM_DETAILS_UPDATED','room',p_room_id,
    jsonb_build_object('before',v_before,'code',v_code,'name',btrim(p_name),'capacity',p_capacity,'active',p_active,'booking_enabled',p_active)
  );
  return true;
end
$$;

revoke all on function public.update_room_details_v2(uuid,text,text,integer,boolean) from public,anon;
grant execute on function public.update_room_details_v2(uuid,text,text,integer,boolean) to authenticated;
-- END SOURCE: 0018_room_layout_key_and_code_edit.sql
commit;

begin;
-- BEGIN SOURCE: 0019_student_booking_key_workflow.sql
-- Student-first booking and key workflow for ITD computer laboratories.
update public.room_types set booking_policy = 'MANUAL_APPROVAL' where code = 'COMPUTER';

create or replace function public.prevent_duplicate_pending_lab_booking()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status='PENDING' and exists(
    select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
    where r.id=new.room_id and rt.code='COMPUTER'
  ) and exists(
    select 1 from public.bookings b where b.room_id=new.room_id and b.id is distinct from new.id
      and b.status in ('PENDING','APPROVED','IN_USE')
      and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')
  ) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
  return new;
end $$;

drop trigger if exists reject_duplicate_pending_lab_booking on public.bookings;
create trigger reject_duplicate_pending_lab_booking before insert or update of starts_at,ends_at,status,room_id on public.bookings
for each row execute function public.prevent_duplicate_pending_lab_booking();

create or replace function public.ensure_key_request_for_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'APPROVED' and new.requires_key
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and not exists (
       select 1 from public.key_loans
       where booking_id = new.id and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')
     ) then
    insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,status)
    values(new.id,new.room_id,'BOOKING',coalesce(new.beneficiary_user_id,new.requester_id),new.requester_id,'REQUESTED');
  end if;
  return new;
end $$;

drop trigger if exists create_key_request_after_booking_approval on public.bookings;
create trigger create_key_request_after_booking_approval
after insert or update of status on public.bookings
for each row execute function public.ensure_key_request_for_booking();

create or replace function public.get_room_slot_permissions(
  p_room_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns table(
  can_book boolean,
  can_request_key boolean,
  booking_reason text,
  key_reason text,
  class_schedule_id uuid,
  own_booking_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_start_local timestamp := p_starts_at at time zone 'Asia/Bangkok';
  v_end_local timestamp := p_ends_at at time zone 'Asia/Bangkok';
  v_schedule uuid;
  v_booking public.bookings;
  v_has_other_booking boolean := false;
  v_is_lab boolean := false;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
  if p_ends_at <= p_starts_at then raise exception 'INVALID_TIME_RANGE'; end if;
  select rt.code='COMPUTER' into v_is_lab from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=p_room_id and r.active and r.booking_enabled;
  if v_is_lab is null then raise exception 'ROOM_NOT_AVAILABLE'; end if;

  select s.id into v_schedule
  from public.class_schedules s
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS'
    and s.day_of_week=extract(dow from v_start_local)::smallint
    and v_start_local::date between s.effective_from and s.effective_until
    and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')
      && tsrange(date '2000-01-01'+v_start_local::time,date '2000-01-01'+v_end_local::time,'[)')
  order by s.start_time limit 1;

  select b.* into v_booking from public.bookings b
  where b.room_id=p_room_id and b.requester_id=v_actor
    and b.status in ('PENDING','APPROVED','IN_USE')
    and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')
  order by b.created_at desc limit 1;

  select exists(select 1 from public.bookings b where b.room_id=p_room_id and b.requester_id<>v_actor
    and b.status in ('PENDING','APPROVED','IN_USE')
    and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) into v_has_other_booking;

  class_schedule_id := v_schedule;
  own_booking_id := v_booking.id;
  if v_schedule is not null then
    can_book := false; booking_reason := 'ช่วงเวลานี้มีตารางเรียน';
    can_request_key := v_is_lab and (public.has_role('STUDENT') or public.has_role('TEACHER'));
    key_reason := case when not v_is_lab then 'การเบิกกุญแจอัตโนมัติจากคาบเรียนรองรับเฉพาะห้องปฏิบัติการ S2407–S2412'
      when can_request_key then null else 'บทบาทนี้ไม่มีสิทธิ์เบิกกุญแจจากคาบเรียน' end;
  elsif v_booking.id is not null then
    can_book := false; booking_reason := 'คุณมีรายการจองช่วงเวลานี้แล้ว';
    can_request_key := v_booking.status in ('APPROVED','IN_USE') and not exists(
      select 1 from public.key_loans where booking_id=v_booking.id
        and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')
    );
    key_reason := case when v_booking.status='PENDING' then 'รอผู้ดูแลอนุมัติการจองก่อน'
      when can_request_key then null else 'ระบบมีคำขอเบิกกุญแจสำหรับรายการนี้แล้ว' end;
  elsif v_has_other_booking then
    can_book := false; can_request_key := false;
    booking_reason := 'ช่วงเวลานี้มีผู้จองแล้ว'; key_reason := 'ไม่สามารถเบิกกุญแจจากการจองของผู้อื่น';
  else
    can_book := true; can_request_key := false;
    booking_reason := null; key_reason := 'ต้องจองห้องและรออนุมัติก่อนจึงจะเบิกกุญแจได้';
  end if;
  return next;
end $$;

create or replace function public.request_booking_key(p_booking_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;v_loan public.key_loans;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select * into v_booking from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if v_booking.status not in ('APPROVED','IN_USE') then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY'; end if;
  update public.bookings set requires_key=true where id=p_booking_id;
  insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,status,expected_return_at,notes)
  values(p_booking_id,v_booking.room_id,'BOOKING',coalesce(v_booking.beneficiary_user_id,v_booking.requester_id),v_actor,'REQUESTED',v_booking.ends_at,nullif(btrim(p_notes),''))
  returning * into v_loan;
  insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'REQUESTED',v_actor,'Key requested from approved booking');
  perform public.write_audit(v_actor,'KEY_REQUESTED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));
  return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';
end $$;

create or replace function public.request_class_key(
  p_room_id uuid,
  p_class_schedule_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_schedule public.class_schedules;
  v_loan public.key_loans;
  v_start_local timestamp := p_starts_at at time zone 'Asia/Bangkok';
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not (public.has_role('STUDENT') or public.has_role('TEACHER')) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select s.* into v_schedule from public.class_schedules s
  join public.rooms r on r.id=s.room_id join public.room_types rt on rt.id=r.room_type_id
  where s.id=p_class_schedule_id and s.room_id=p_room_id and s.active and s.status='ACTIVE'
    and s.schedule_type='CLASS' and rt.code='COMPUTER' for share;
  if not found then raise exception 'VALID_CLASS_SCHEDULE_REQUIRED'; end if;
  if extract(dow from v_start_local)::smallint<>v_schedule.day_of_week
    or v_start_local::date not between v_schedule.effective_from and v_schedule.effective_until
    or v_start_local::time<v_schedule.start_time or (p_ends_at at time zone 'Asia/Bangkok')::time>v_schedule.end_time
  then raise exception 'KEY_USAGE_OUTSIDE_CLASS_PERIOD'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_class_schedule_id::text||v_actor::text,2));
  if exists(select 1 from public.key_loans where class_schedule_id=p_class_schedule_id and borrower_id=v_actor
    and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')
    and expected_return_at=p_ends_at) then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS'; end if;
  insert into public.key_loans(room_id,usage_source,class_schedule_id,borrower_id,requested_by,authorized_by,
    status,approved_at,approved_by,expected_return_at,notes)
  values(p_room_id,'CLASS_SCHEDULE',p_class_schedule_id,v_actor,v_actor,v_actor,'APPROVED',now(),v_actor,p_ends_at,nullif(btrim(p_notes),''))
  returning * into v_loan;
  insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes)
  values(v_loan.id,'APPROVED',v_actor,'Automatically approved from an active class occurrence');
  perform public.write_audit(v_actor,'CLASS_KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan.id,jsonb_build_object('class_schedule_id',p_class_schedule_id));
  return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
end $$;

create or replace function public.report_key_damage(p_key_loan_id uuid,p_description text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_loan public.key_loans; v_incident uuid;
begin
  if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if nullif(btrim(p_description),'') is null then raise exception 'DAMAGE_DESCRIPTION_REQUIRED'; end if;
  select * into v_loan from public.key_loans where id=p_key_loan_id for update;
  if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
  if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if v_loan.status not in ('CHECKED_OUT','LATE') or v_loan.key_id is null then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
  update public.key_loans set status='DAMAGED',notes=btrim(p_description) where id=p_key_loan_id;
  update public.room_keys set status='DAMAGED' where id=v_loan.key_id;
  insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
  values(v_loan.key_id,p_key_loan_id,v_actor,v_actor,'DAMAGED',btrim(p_description)) returning id into v_incident;
  insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
  values(p_key_loan_id,v_loan.status,'DAMAGED',v_actor,btrim(p_description));
  perform public.write_audit(v_actor,'KEY_DAMAGE_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('incident_id',v_incident));
  return jsonb_build_object('id',p_key_loan_id,'status','DAMAGED','incident_id',v_incident);
end $$;

revoke all on function public.get_room_slot_permissions(uuid,timestamptz,timestamptz),
 public.request_booking_key(uuid,text),public.request_class_key(uuid,uuid,timestamptz,timestamptz,text),public.report_key_damage(uuid,text) from public,anon;
grant execute on function public.get_room_slot_permissions(uuid,timestamptz,timestamptz),
 public.request_booking_key(uuid,text),public.request_class_key(uuid,uuid,timestamptz,timestamptz,text),public.report_key_damage(uuid,text) to authenticated;

do $$ declare v_table text; begin
  foreach v_table in array array['rooms','class_schedules','bookings','key_loans','key_incidents'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=v_table) then
      execute format('alter publication supabase_realtime add table public.%I',v_table);
    end if;
  end loop;
end $$;
-- END SOURCE: 0019_student_booking_key_workflow.sql
commit;

begin;
-- BEGIN SOURCE: 0020_calendar_booking_notifications_and_key_reports.sql
-- Calendar-day booking limit, privacy-safe ownership marker, notifications, and borrower key reports.
create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
 v_policy public.booking_policy; v_student_allowed boolean; v_status public.booking_status;
 v_max_days integer; v_open time; v_close time; v_start_local timestamp; v_end_local timestamp; v_today date;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not (public.has_role('STUDENT') or public.has_role('TEACHER') or public.has_role('ADMIN')) then raise exception 'BOOKING_ROLE_REQUIRED' using errcode='42501'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED' using errcode='22023'; end if;
 select r.* into v_room from public.rooms r where r.id=p_room_id and r.active for share;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select rt.booking_policy,rt.student_booking_allowed into v_policy,v_student_allowed from public.room_types rt where rt.id=v_room.room_type_id;
 if not v_room.booking_enabled then raise exception 'ROOM_BOOKING_DISABLED'; end if;
 select (rule_value#>>'{}')::integer into v_max_days from public.booking_rules where rule_key='MAX_ADVANCE_BOOKING_DAYS' and active;
 select (rule_value#>>'{}')::time into v_open from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and active;
 select (rule_value#>>'{}')::time into v_close from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active;
 v_max_days:=coalesce(v_max_days,3); v_open:=coalesce(v_open,'08:30'::time); v_close:=coalesce(v_close,'17:30'::time);
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok'; v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 v_today:=(now() at time zone 'Asia/Bangkok')::date;
 if v_start_local::date>v_today+v_max_days then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<v_open or v_end_local::time>v_close then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
 if not v_student_allowed and not (public.has_role('TEACHER') or public.has_role('ADMIN')) then raise exception 'COLD_ROOM_TEACHER_OR_ADMIN_ONLY' using errcode='42501'; end if;
 v_status:=case when v_policy='MANUAL_APPROVAL' then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,requires_key,notes,status)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes,v_status) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,v_status,v_actor,case when v_status='APPROVED' then 'Automatically confirmed by room policy' else 'Manual approval required by room policy' end);
 perform public.write_audit(v_actor,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id,'policy',v_policy,'status',v_status));
 perform public.create_notification(v_actor,case when v_status='APPROVED' then 'BOOKING_CONFIRMED' else 'BOOKING_SUBMITTED' end,case when v_status='APPROVED' then 'Booking confirmed' else 'Booking submitted' end,'Booking '||v_booking.booking_code||case when v_status='APPROVED' then ' is confirmed.' else ' is pending approval.' end,'booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

drop function if exists public.get_public_room_schedule_events(uuid,date,date);
create function public.get_public_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text,is_mine boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 if not exists(select 1 from public.rooms r where r.id=p_room_id and r.active) then raise exception 'ROOM_NOT_FOUND'; end if;
 return query with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'class:'||s.id||':'||s.occurrence_date event_id,'CLASS'::text event_kind,coalesce(s.course_code||' · '||s.subject_name,'ตารางเรียน') event_title,(s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,(s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,null::uuid event_source_id,'CLASS_SCHEDULE'::text event_source_type,'ACTIVE'::text event_status,false event_is_mine from occurrences s
  union all select 'booking:'||md5(b.id::text),'BOOKING','มีการจองห้อง',b.starts_at,b.ends_at,null::uuid,'BOOKING',b.status::text,(auth.uid() is not null and (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid())) from public.bookings b where b.room_id=p_room_id and b.status in ('PENDING','APPROVED','IN_USE') and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE',false from public.room_blocks rb where rb.room_id=p_room_id and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 ) select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status,e.event_is_mine from events e order by e.event_start;
end $$;
revoke all on function public.get_public_room_schedule_events(uuid,date,date) from public;
grant execute on function public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;

create or replace function public.report_key_issue(p_key_loan_id uuid,p_condition text,p_description text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_loan public.key_loans;v_status public.key_loan_status;v_incident public.incident_type;v_incident_id uuid;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if upper(p_condition) not in ('LOST','DAMAGED') then raise exception 'INVALID_KEY_CONDITION'; end if;
 if nullif(btrim(p_description),'') is null then raise exception 'ISSUE_DESCRIPTION_REQUIRED'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
 if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if v_loan.status not in ('CHECKED_OUT','LATE') or v_loan.key_id is null then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
 v_status:=upper(p_condition)::public.key_loan_status;v_incident:=upper(p_condition)::public.incident_type;
 update public.key_loans set status=v_status,notes=btrim(p_description) where id=p_key_loan_id;
 update public.room_keys set status=upper(p_condition)::public.key_status where id=v_loan.key_id;
 insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description) values(v_loan.key_id,p_key_loan_id,v_actor,v_actor,v_incident,btrim(p_description)) returning id into v_incident_id;
 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes) values(p_key_loan_id,v_loan.status,v_status,v_actor,btrim(p_description));
 perform public.write_audit(v_actor,'KEY_ISSUE_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('condition',v_status,'incident_id',v_incident_id));
 return jsonb_build_object('id',p_key_loan_id,'status',v_status,'incident_id',v_incident_id);
end $$;
revoke all on function public.report_key_issue(uuid,text,text) from public,anon;
grant execute on function public.report_key_issue(uuid,text,text) to authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications; end if;
end $$;
-- END SOURCE: 0020_calendar_booking_notifications_and_key_reports.sql
commit;

begin;
-- BEGIN SOURCE: 0021_user_reported_key_status_and_notification_reads.sql
-- Users own their notification read state and report key lifecycle events themselves.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=v_actor;
end $$;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_count integer;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 update public.notifications set read_at=now() where user_id=v_actor and read_at is null;
 get diagnostics v_count=row_count;
 return v_count;
end $$;

revoke all on function public.mark_notification_read(uuid),public.mark_all_notifications_read() from public,anon;
grant execute on function public.mark_notification_read(uuid),public.mark_all_notifications_read() to authenticated;

alter table public.key_incidents alter column key_id drop not null;

create or replace function public.report_key_status(p_key_loan_id uuid,p_action text,p_description text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_loan public.key_loans;v_action text:=upper(btrim(p_action));
 v_next public.key_loan_status;v_incident public.incident_type;v_incident_id uuid;v_now timestamptz:=now();
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if v_action not in ('CHECKED_OUT','RETURNED','LOST','DAMAGED') then raise exception 'INVALID_KEY_ACTION'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
 if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;

 if v_action='CHECKED_OUT' then
  if v_loan.status<>'APPROVED' then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
  update public.key_loans set status='CHECKED_OUT',checked_out_at=v_now,checked_out_by=v_actor where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status='CHECKED_OUT' where id=v_loan.key_id and status in ('AVAILABLE','RESERVED'); end if;
  v_next:='CHECKED_OUT';
 elsif v_action='RETURNED' then
  if v_loan.status not in ('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
  update public.key_loans set status='RETURN_REPORTED',user_reported_return_at=v_now,return_confirmed_by=v_actor where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status='RESERVED' where id=v_loan.key_id; end if;
  v_next:='RETURN_REPORTED';
 else
  if v_loan.status not in ('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
  if nullif(btrim(p_description),'') is null then raise exception 'ISSUE_DESCRIPTION_REQUIRED'; end if;
  v_next:=v_action::public.key_loan_status;v_incident:=v_action::public.incident_type;
  update public.key_loans set status=v_next,notes=btrim(p_description) where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status=v_action::public.key_status where id=v_loan.key_id; end if;
  insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
  values(v_loan.key_id,p_key_loan_id,v_actor,v_actor,v_incident,btrim(p_description)) returning id into v_incident_id;
 end if;

 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
 values(p_key_loan_id,v_loan.status,v_next,v_actor,coalesce(nullif(btrim(p_description),''),'User reported '||v_action));
 perform public.write_audit(v_actor,'KEY_STATUS_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('action',v_action,'status',v_next,'incident_id',v_incident_id));
 return jsonb_build_object('id',p_key_loan_id,'status',v_next,'reported_at',v_now,'late',v_action='RETURNED' and v_loan.expected_return_at is not null and v_now>v_loan.expected_return_at);
end $$;

revoke all on function public.report_key_status(uuid,text,text) from public,anon;
grant execute on function public.report_key_status(uuid,text,text) to authenticated;

create or replace view public.admin_key_activity_v with (security_invoker=true) as
select l.*,k.key_code,r.code room_code,r.name room_name,
 (l.status='RETURN_REPORTED' and l.expected_return_at is not null and l.user_reported_return_at>l.expected_return_at) returned_late
from public.key_loans l left join public.room_keys k on k.id=l.key_id join public.rooms r on r.id=l.room_id;
grant select on public.admin_key_activity_v to authenticated;
-- END SOURCE: 0021_user_reported_key_status_and_notification_reads.sql
commit;

begin;
-- BEGIN SOURCE: 0022_configurable_usage_permissions.sql
-- Configurable booking/key permissions for S2407-S2412.
insert into public.booking_rules(rule_key,rule_value,description,active)
values('LAB_USAGE_PERMISSION_POLICY','{"student_class_key":true,"teacher_class_key":true,"priority_class_key":true,"student_empty_booking":true,"teacher_empty_booking":true,"priority_empty_booking":true,"manual_approval":true}'::jsonb,'Role and scenario permissions for S2407-S2412',true)
on conflict(rule_key) do nothing;

create or replace function public.get_usage_permission_policy()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_policy jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 select rule_value into v_policy from public.booking_rules where rule_key='LAB_USAGE_PERMISSION_POLICY' and active;
 return coalesce(v_policy,'{}'::jsonb);
end $$;

create or replace function public.update_usage_permission_policy(p_policy jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_keys text[]:=array['student_class_key','teacher_class_key','priority_class_key','student_empty_booking','teacher_empty_booking','priority_empty_booking','manual_approval'];v_key text;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 foreach v_key in array v_keys loop
  if not (p_policy?v_key) or jsonb_typeof(p_policy->v_key)<>'boolean' then raise exception 'INVALID_USAGE_POLICY'; end if;
 end loop;
 update public.booking_rules set rule_value=p_policy,description='Role and scenario permissions for S2407-S2412',active=true,updated_by=v_actor,updated_at=now() where rule_key='LAB_USAGE_PERMISSION_POLICY';
 update public.room_types set booking_policy=case when (p_policy->>'manual_approval')::boolean then 'MANUAL_APPROVAL'::public.booking_policy else 'AUTO_CONFIRM'::public.booking_policy end
 where id in(select distinct room_type_id from public.rooms where layout_key~'^S24(0[7-9]|1[0-2])$');
 perform public.write_audit(v_actor,'USAGE_PERMISSION_POLICY_UPDATED','booking_rule',null,p_policy);
 return p_policy;
end $$;

create or replace function public.get_room_slot_permissions(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(can_book boolean,can_request_key boolean,booking_reason text,key_reason text,class_schedule_id uuid,own_booking_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_end_local timestamp:=p_ends_at at time zone 'Asia/Bangkok';
 v_schedule uuid;v_booking public.bookings;v_has_other_booking boolean:=false;v_is_lab boolean:=false;v_policy jsonb;
 v_class_key_allowed boolean:=false;v_empty_booking_allowed boolean:=false;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE'; end if;
 select r.layout_key~'^S24(0[7-9]|1[0-2])$',coalesce(br.rule_value,'{}'::jsonb) into v_is_lab,v_policy
 from public.rooms r left join public.booking_rules br on br.rule_key='LAB_USAGE_PERMISSION_POLICY' and br.active where r.id=p_room_id and r.active and r.booking_enabled;
 if v_is_lab is null then raise exception 'ROOM_NOT_AVAILABLE'; end if;
 v_class_key_allowed:=case when public.has_role('ADMIN') then true when public.has_role('PRIORITY_USER') then coalesce((v_policy->>'priority_class_key')::boolean,true) when public.has_role('TEACHER') then coalesce((v_policy->>'teacher_class_key')::boolean,true) else coalesce((v_policy->>'student_class_key')::boolean,true) end;
 v_empty_booking_allowed:=case when public.has_role('ADMIN') then true when public.has_role('PRIORITY_USER') then coalesce((v_policy->>'priority_empty_booking')::boolean,true) when public.has_role('TEACHER') then coalesce((v_policy->>'teacher_empty_booking')::boolean,true) else coalesce((v_policy->>'student_empty_booking')::boolean,true) end;
 select s.id into v_schedule from public.class_schedules s where s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' and s.day_of_week=extract(dow from v_start_local)::smallint and v_start_local::date between s.effective_from and s.effective_until and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')&&tsrange(date '2000-01-01'+v_start_local::time,date '2000-01-01'+v_end_local::time,'[)') order by s.start_time limit 1;
 select b.* into v_booking from public.bookings b where b.room_id=p_room_id and b.requester_id=v_actor and b.status in ('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)') order by b.created_at desc limit 1;
 select exists(select 1 from public.bookings b where b.room_id=p_room_id and b.requester_id<>v_actor and b.status in ('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) into v_has_other_booking;
 class_schedule_id:=v_schedule;own_booking_id:=v_booking.id;
 if v_schedule is not null then
  can_book:=false;booking_reason:='ช่วงเวลานี้มีตารางเรียน';can_request_key:=v_is_lab and v_class_key_allowed;
  key_reason:=case when not v_is_lab then 'รองรับการเบิกอัตโนมัติเฉพาะ S2407–S2412' when can_request_key then null else 'กฎปัจจุบันไม่อนุญาตให้บทบาทนี้เบิกกุญแจจากคาบเรียน' end;
 elsif v_booking.id is not null then
  can_book:=false;booking_reason:='คุณมีรายการจองช่วงเวลานี้แล้ว';can_request_key:=v_booking.status in ('APPROVED','IN_USE') and not exists(select 1 from public.key_loans where booking_id=v_booking.id and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED'));
  key_reason:=case when v_booking.status='PENDING' then 'รอผู้ดูแลอนุมัติการจองก่อน' when can_request_key then null else 'ระบบมีคำขอเบิกกุญแจสำหรับรายการนี้แล้ว' end;
 elsif v_has_other_booking then can_book:=false;can_request_key:=false;booking_reason:='ช่วงเวลานี้มีผู้จองแล้ว';key_reason:='ไม่สามารถเบิกกุญแจจากการจองของผู้อื่น';
 else can_book:=not v_is_lab or v_empty_booking_allowed;can_request_key:=false;booking_reason:=case when can_book then null else 'กฎปัจจุบันไม่อนุญาตให้บทบาทนี้จองห้อง' end;key_reason:='ต้องจองห้องและรออนุมัติก่อนจึงจะเบิกกุญแจได้';end if;
 return next;
end $$;

create or replace function public.request_class_key(p_room_id uuid,p_class_schedule_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_schedule public.class_schedules;v_loan public.key_loans;v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_policy jsonb;v_allowed boolean;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 select rule_value into v_policy from public.booking_rules where rule_key='LAB_USAGE_PERMISSION_POLICY' and active;
 v_allowed:=case when public.has_role('ADMIN') then true when public.has_role('PRIORITY_USER') then coalesce((v_policy->>'priority_class_key')::boolean,true) when public.has_role('TEACHER') then coalesce((v_policy->>'teacher_class_key')::boolean,true) else public.has_role('STUDENT') and coalesce((v_policy->>'student_class_key')::boolean,true) end;
 if not v_allowed then raise exception 'KEY_POLICY_DENIED' using errcode='42501'; end if;
 select s.* into v_schedule from public.class_schedules s join public.rooms r on r.id=s.room_id where s.id=p_class_schedule_id and s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' and r.layout_key~'^S24(0[7-9]|1[0-2])$' for share;
 if not found then raise exception 'VALID_CLASS_SCHEDULE_REQUIRED'; end if;
 if extract(dow from v_start_local)::smallint<>v_schedule.day_of_week or v_start_local::date not between v_schedule.effective_from and v_schedule.effective_until or v_start_local::time<v_schedule.start_time or (p_ends_at at time zone 'Asia/Bangkok')::time>v_schedule.end_time then raise exception 'KEY_USAGE_OUTSIDE_CLASS_PERIOD'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_class_schedule_id::text||v_actor::text,2));
 if exists(select 1 from public.key_loans where class_schedule_id=p_class_schedule_id and borrower_id=v_actor and status in ('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED') and expected_return_at=p_ends_at) then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS'; end if;
 insert into public.key_loans(room_id,usage_source,class_schedule_id,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,expected_return_at,notes) values(p_room_id,'CLASS_SCHEDULE',p_class_schedule_id,v_actor,v_actor,v_actor,'APPROVED',now(),v_actor,p_ends_at,nullif(btrim(p_notes),'')) returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'APPROVED',v_actor,'Automatically approved from configured class permission');
 perform public.write_audit(v_actor,'CLASS_KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan.id,jsonb_build_object('class_schedule_id',p_class_schedule_id));return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
end $$;

create or replace function public.enforce_managed_lab_booking_policy()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_policy jsonb;v_managed boolean;v_allowed boolean;
begin
 select r.layout_key~'^S24(0[7-9]|1[0-2])$',br.rule_value into v_managed,v_policy from public.rooms r left join public.booking_rules br on br.rule_key='LAB_USAGE_PERMISSION_POLICY' and br.active where r.id=new.room_id;
 if not coalesce(v_managed,false) or public.has_role('ADMIN') then return new; end if;
 v_allowed:=case when public.has_role('PRIORITY_USER') then coalesce((v_policy->>'priority_empty_booking')::boolean,true) when public.has_role('TEACHER') then coalesce((v_policy->>'teacher_empty_booking')::boolean,true) else public.has_role('STUDENT') and coalesce((v_policy->>'student_empty_booking')::boolean,true) end;
 if not v_allowed then raise exception 'BOOKING_POLICY_DENIED' using errcode='42501'; end if;
 return new;
end $$;

drop trigger if exists enforce_managed_lab_booking_policy on public.bookings;
create trigger enforce_managed_lab_booking_policy before insert on public.bookings for each row execute function public.enforce_managed_lab_booking_policy();

revoke all on function public.get_usage_permission_policy(),public.update_usage_permission_policy(jsonb) from public,anon;
grant execute on function public.get_usage_permission_policy(),public.update_usage_permission_policy(jsonb) to authenticated;
-- END SOURCE: 0022_configurable_usage_permissions.sql
commit;

begin;
-- BEGIN SOURCE: 0023_room_permission_matrix_and_key_availability.sql
-- Per-room Guest/Student permission matrix and date-safe key checkout.
create table public.room_usage_policies(
 room_id uuid primary key references public.rooms(id) on delete cascade,
 guest_view_details boolean not null default true,guest_view_schedule boolean not null default true,
 student_view_details boolean not null default true,student_view_schedule boolean not null default true,
 student_book_empty boolean not null default true,student_class_key boolean not null default true,
 student_own_booking_key boolean not null default true,student_manage_own_booking boolean not null default true,
 student_view_own_key_status boolean not null default true,student_view_own_history boolean not null default true,
 manual_approval boolean not null default true,updated_by uuid references public.profiles(id),updated_at timestamptz not null default now()
);
insert into public.room_usage_policies(room_id) select id from public.rooms on conflict do nothing;
alter table public.room_usage_policies enable row level security;
create policy "settings managers read room policies" on public.room_usage_policies for select to authenticated using(public.has_permission('SETTINGS_MANAGE'));
revoke all on public.room_usage_policies from anon,authenticated;
grant select on public.room_usage_policies to authenticated;

create or replace function public.get_room_usage_policy(p_room_id uuid)
returns setof public.room_usage_policies language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 return query select * from public.room_usage_policies where room_id=p_room_id;
end $$;

create or replace function public.update_room_usage_policy(p_room_id uuid,p_policy jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_before jsonb;v_key text;v_keys text[]:=array['guest_view_details','guest_view_schedule','student_view_details','student_view_schedule','student_book_empty','student_class_key','student_own_booking_key','student_manage_own_booking','student_view_own_key_status','student_view_own_history','manual_approval'];
begin
 if v_actor is null or not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if not exists(select 1 from public.rooms where id=p_room_id) then raise exception 'ROOM_NOT_FOUND'; end if;
 foreach v_key in array v_keys loop if not(p_policy?v_key) or jsonb_typeof(p_policy->v_key)<>'boolean' then raise exception 'INVALID_ROOM_USAGE_POLICY';end if;end loop;
 select to_jsonb(p) into v_before from public.room_usage_policies p where room_id=p_room_id for update;
 insert into public.room_usage_policies(room_id,guest_view_details,guest_view_schedule,student_view_details,student_view_schedule,student_book_empty,student_class_key,student_own_booking_key,student_manage_own_booking,student_view_own_key_status,student_view_own_history,manual_approval,updated_by,updated_at)
 values(p_room_id,(p_policy->>'guest_view_details')::boolean,(p_policy->>'guest_view_schedule')::boolean,(p_policy->>'student_view_details')::boolean,(p_policy->>'student_view_schedule')::boolean,(p_policy->>'student_book_empty')::boolean,(p_policy->>'student_class_key')::boolean,(p_policy->>'student_own_booking_key')::boolean,(p_policy->>'student_manage_own_booking')::boolean,(p_policy->>'student_view_own_key_status')::boolean,(p_policy->>'student_view_own_history')::boolean,(p_policy->>'manual_approval')::boolean,v_actor,now())
 on conflict(room_id) do update set guest_view_details=excluded.guest_view_details,guest_view_schedule=excluded.guest_view_schedule,student_view_details=excluded.student_view_details,student_view_schedule=excluded.student_view_schedule,student_book_empty=excluded.student_book_empty,student_class_key=excluded.student_class_key,student_own_booking_key=excluded.student_own_booking_key,student_manage_own_booking=excluded.student_manage_own_booking,student_view_own_key_status=excluded.student_view_own_key_status,student_view_own_history=excluded.student_view_own_history,manual_approval=excluded.manual_approval,updated_by=v_actor,updated_at=now();
 perform public.write_audit(v_actor,'ROOM_USAGE_POLICY_UPDATED','room',p_room_id,jsonb_build_object('before',v_before,'after',p_policy));return true;
end $$;

drop function public.get_public_room_catalog();
create function public.get_public_room_catalog()
returns table(id uuid,code text,layout_key text,name text,room_type_name text,building text,floor text,capacity integer,active boolean,academic_schedule_confirmed boolean)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.layout_key,r.name,rt.name,r.building,r.floor,r.capacity,r.active,r.academic_schedule_confirmed
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id left join public.room_usage_policies p on p.room_id=r.id
 where case when auth.uid() is null then coalesce(p.guest_view_details,true) when public.has_role('STUDENT') then coalesce(p.student_view_details,true) else true end order by r.code
$$;
revoke all on function public.get_public_room_catalog() from public;grant execute on function public.get_public_room_catalog() to anon,authenticated;

create or replace function public.get_public_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text,is_mine boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_can_view boolean;
begin
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 if not exists(select 1 from public.rooms r where r.id=p_room_id and r.active) then raise exception 'ROOM_NOT_FOUND'; end if;
 select case when auth.uid() is null then coalesce(p.guest_view_schedule,true) when public.has_role('STUDENT') then coalesce(p.student_view_schedule,true) else true end into v_can_view from public.rooms r left join public.room_usage_policies p on p.room_id=r.id where r.id=p_room_id;
 if not coalesce(v_can_view,false) then raise exception 'SCHEDULE_POLICY_DENIED' using errcode='42501';end if;
 return query with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'class:'||s.id||':'||s.occurrence_date event_id,'CLASS'::text event_kind,coalesce(s.course_code||' · '||s.subject_name,'ตารางเรียน') event_title,(s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,(s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,null::uuid event_source_id,'CLASS_SCHEDULE'::text event_source_type,'ACTIVE'::text event_status,false event_is_mine from occurrences s
  union all select 'booking:'||md5(b.id::text),'BOOKING','มีการจองห้อง',b.starts_at,b.ends_at,null::uuid,'BOOKING',b.status::text,(auth.uid() is not null and (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid())) from public.bookings b where b.room_id=p_room_id and b.status in ('PENDING','APPROVED','IN_USE') and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE',false from public.room_blocks rb where rb.room_id=p_room_id and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 ) select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status,e.event_is_mine from events e order by e.event_start;
end $$;
revoke all on function public.get_public_room_schedule_events(uuid,date,date) from public;grant execute on function public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;

create or replace function public.get_room_slot_permissions(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(can_book boolean,can_request_key boolean,booking_reason text,key_reason text,class_schedule_id uuid,own_booking_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_end_local timestamp:=p_ends_at at time zone 'Asia/Bangkok';v_schedule uuid;v_booking public.bookings;v_other boolean:=false;v_policy public.room_usage_policies;v_student boolean;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE';end if;
 if not exists(select 1 from public.rooms where id=p_room_id and active and booking_enabled) then raise exception 'ROOM_NOT_AVAILABLE';end if;
 select * into v_policy from public.room_usage_policies where room_id=p_room_id;v_student:=public.has_role('STUDENT');
 select s.id into v_schedule from public.class_schedules s where s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' and s.day_of_week=extract(dow from v_start_local)::smallint and v_start_local::date between s.effective_from and s.effective_until and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')&&tsrange(date '2000-01-01'+v_start_local::time,date '2000-01-01'+v_end_local::time,'[)') limit 1;
 select * into v_booking from public.bookings b where b.room_id=p_room_id and (b.requester_id=v_actor or b.beneficiary_user_id=v_actor) and b.status in('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)') order by b.created_at desc limit 1;
 select exists(select 1 from public.bookings b where b.room_id=p_room_id and b.requester_id<>v_actor and b.beneficiary_user_id is distinct from v_actor and b.status in('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) into v_other;
 class_schedule_id:=v_schedule;own_booking_id:=v_booking.id;
 if v_schedule is not null then can_book:=false;booking_reason:='ช่วงเวลานี้มีตารางเรียน';can_request_key:=not v_student or coalesce(v_policy.student_class_key,true);key_reason:=case when can_request_key then null else 'ห้องนี้ไม่อนุญาตให้ Student เบิกกุญแจจากคาบเรียน' end;
 elsif v_booking.id is not null then can_book:=false;booking_reason:='คุณมีรายการจองช่วงเวลานี้แล้ว';can_request_key:=v_booking.status in('APPROVED','IN_USE') and (not v_student or coalesce(v_policy.student_own_booking_key,true)) and (v_booking.starts_at at time zone 'Asia/Bangkok')::date<=(now() at time zone 'Asia/Bangkok')::date and not exists(select 1 from public.key_loans where booking_id=v_booking.id and status in('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED'));key_reason:=case when v_booking.status='PENDING' then 'รอผู้ดูแลอนุมัติการจองก่อน' when (v_booking.starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then 'สามารถเบิกกุญแจได้เมื่อถึงวันที่จอง' when can_request_key then null else 'ไม่มีสิทธิ์หรือมีคำขอเบิกกุญแจแล้ว' end;
 elsif v_other then can_book:=false;can_request_key:=false;booking_reason:='ช่วงเวลานี้มีผู้จองแล้ว';key_reason:='ไม่สามารถเบิกกุญแจจากการจองของผู้อื่น';
 else can_book:=not v_student or coalesce(v_policy.student_book_empty,true);can_request_key:=false;booking_reason:=case when can_book then null else 'ห้องนี้ไม่อนุญาตให้ Student จอง' end;key_reason:='ต้องจองห้องและรออนุมัติก่อน';end if;return next;
end $$;

create or replace function public.request_class_key(p_room_id uuid,p_class_schedule_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_schedule public.class_schedules;v_loan public.key_loans;v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_allowed boolean;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
 select coalesce(p.student_class_key,true) into v_allowed from public.rooms r left join public.room_usage_policies p on p.room_id=r.id where r.id=p_room_id and r.active;
 if not found then raise exception 'ROOM_NOT_AVAILABLE';end if;
 if public.has_role('STUDENT') and not v_allowed then raise exception 'KEY_POLICY_DENIED' using errcode='42501';end if;
 select s.* into v_schedule from public.class_schedules s where s.id=p_class_schedule_id and s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' for share;
 if not found then raise exception 'VALID_CLASS_SCHEDULE_REQUIRED';end if;
 if extract(dow from v_start_local)::smallint<>v_schedule.day_of_week or v_start_local::date not between v_schedule.effective_from and v_schedule.effective_until or v_start_local::time<v_schedule.start_time or (p_ends_at at time zone 'Asia/Bangkok')::time>v_schedule.end_time then raise exception 'KEY_USAGE_OUTSIDE_CLASS_PERIOD';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_class_schedule_id::text||v_actor::text,2));
 if exists(select 1 from public.key_loans where class_schedule_id=p_class_schedule_id and borrower_id=v_actor and status in('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED') and expected_return_at=p_ends_at) then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';end if;
 insert into public.key_loans(room_id,usage_source,class_schedule_id,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,expected_return_at,notes) values(p_room_id,'CLASS_SCHEDULE',p_class_schedule_id,v_actor,v_actor,v_actor,'APPROVED',now(),v_actor,p_ends_at,nullif(btrim(p_notes),'')) returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'APPROVED',v_actor,'Automatically approved from room class-key permission');
 perform public.write_audit(v_actor,'CLASS_KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan.id,jsonb_build_object('class_schedule_id',p_class_schedule_id));return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
end $$;

create or replace function public.enforce_managed_lab_booking_policy()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_policy public.room_usage_policies;
begin select * into v_policy from public.room_usage_policies where room_id=new.room_id;if public.has_role('STUDENT') and not coalesce(v_policy.student_book_empty,true) then raise exception 'BOOKING_POLICY_DENIED' using errcode='42501';end if;if public.has_role('STUDENT') then new.status:=case when coalesce(v_policy.manual_approval,true) then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;end if;return new;end $$;

create or replace function public.request_booking_key(p_booking_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;v_loan public.key_loans;v_policy public.room_usage_policies;
begin if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;select * into v_booking from public.bookings where id=p_booking_id for update;if not found then raise exception 'BOOKING_NOT_FOUND';end if;if v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor then raise exception 'FORBIDDEN' using errcode='42501';end if;if v_booking.status not in('APPROVED','IN_USE') then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY';end if;if (v_booking.starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then raise exception 'KEY_NOT_AVAILABLE_BEFORE_BOOKING_DATE';end if;select * into v_policy from public.room_usage_policies where room_id=v_booking.room_id;if public.has_role('STUDENT') and not coalesce(v_policy.student_own_booking_key,true) then raise exception 'KEY_POLICY_DENIED' using errcode='42501';end if;
 update public.bookings set requires_key=true where id=p_booking_id;insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,status,expected_return_at,notes) values(p_booking_id,v_booking.room_id,'BOOKING',coalesce(v_booking.beneficiary_user_id,v_booking.requester_id),v_actor,'REQUESTED',v_booking.ends_at,nullif(btrim(p_notes),'')) returning * into v_loan;insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'REQUESTED',v_actor,'Key requested from approved booking');perform public.write_audit(v_actor,'KEY_REQUESTED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));return jsonb_build_object('id',v_loan.id,'status',v_loan.status);exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';end $$;

drop view public.key_loan_report_v;
create view public.key_loan_report_v with(security_invoker=true) as select l.id,l.room_id,r.code room_code,l.key_id,k.key_code,l.borrower_id,l.usage_source,l.status,l.checked_out_at,l.expected_return_at,l.user_reported_return_at,l.returned_at,b.starts_at available_from,(l.expected_return_at is not null and coalesce(l.user_reported_return_at,l.returned_at,now())>l.expected_return_at and l.status in('CHECKED_OUT','LATE','RETURN_REPORTED')) overdue from public.key_loans l join public.rooms r on r.id=l.room_id left join public.room_keys k on k.id=l.key_id left join public.bookings b on b.id=l.booking_id;
grant select on public.key_loan_report_v to authenticated;

create or replace function public.enforce_key_checkout_date()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_starts_at timestamptz;
begin if new.status='CHECKED_OUT' and old.status='APPROVED' and new.booking_id is not null then select starts_at into v_starts_at from public.bookings where id=new.booking_id;if (v_starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then raise exception 'KEY_NOT_AVAILABLE_BEFORE_BOOKING_DATE';end if;end if;return new;end $$;
drop trigger if exists enforce_key_checkout_date on public.key_loans;
create trigger enforce_key_checkout_date before update of status on public.key_loans for each row execute function public.enforce_key_checkout_date();

create or replace function public.enforce_student_booking_management_policy()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_allowed boolean;
begin if new.status='CANCELLED' and old.status is distinct from new.status and old.requester_id=auth.uid() and public.has_role('STUDENT') then select student_manage_own_booking into v_allowed from public.room_usage_policies where room_id=old.room_id;if not coalesce(v_allowed,true) then raise exception 'BOOKING_MANAGEMENT_POLICY_DENIED' using errcode='42501';end if;end if;return new;end $$;
drop trigger if exists enforce_student_booking_management_policy on public.bookings;
create trigger enforce_student_booking_management_policy before update of status on public.bookings for each row execute function public.enforce_student_booking_management_policy();

create or replace function public.get_admin_key_cabinet()
returns table(room_id uuid,room_code text,room_name text,room_active boolean,key_status text,available_keys bigint,held_keys bigint)
language plpgsql stable security definer set search_path='' as $$
begin if auth.uid() is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;return query select r.id,r.code,r.name,r.active,case when not r.active then 'ROOM_CLOSED' when exists(select 1 from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE','RETURN_REPORTED')) then 'CHECKED_OUT' else 'AVAILABLE' end,count(k.id) filter(where k.active and k.status='AVAILABLE'),(select count(*) from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE','RETURN_REPORTED')) from public.rooms r left join public.room_keys k on k.room_id=r.id group by r.id order by r.code;end $$;

revoke all on function public.get_room_usage_policy(uuid),public.update_room_usage_policy(uuid,jsonb),public.get_admin_key_cabinet() from public,anon;
grant execute on function public.get_room_usage_policy(uuid),public.update_room_usage_policy(uuid,jsonb),public.get_admin_key_cabinet() to authenticated;
-- END SOURCE: 0023_room_permission_matrix_and_key_availability.sql
commit;

begin;
-- BEGIN SOURCE: 0024_self_service_key_return.sql
-- Complete borrower returns immediately and serialize room-level checkout.
insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
select id,'RETURN_REPORTED','RETURNED',return_confirmed_by,'Completed by self-service return migration'
from public.key_loans where status='RETURN_REPORTED';

update public.room_keys k set status='AVAILABLE',updated_at=now()
where exists(select 1 from public.key_loans l where l.key_id=k.id and l.status='RETURN_REPORTED');

update public.key_loans set status='RETURNED',returned_at=coalesce(user_reported_return_at,now()),returned_to=return_confirmed_by
where status='RETURN_REPORTED';

create or replace function public.enforce_single_room_key_holder()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in('CHECKED_OUT','LATE') then
  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text,4));
  if exists(select 1 from public.key_loans l where l.room_id=new.room_id and l.id<>new.id and l.status in('CHECKED_OUT','LATE')) then
   raise exception 'ROOM_KEY_ALREADY_CHECKED_OUT' using errcode='23505';
  end if;
 end if;
 return new;
end $$;

drop trigger if exists enforce_single_room_key_holder on public.key_loans;
create trigger enforce_single_room_key_holder before insert or update of status,room_id on public.key_loans
for each row execute function public.enforce_single_room_key_holder();

create or replace function public.report_key_status(p_key_loan_id uuid,p_action text,p_description text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_loan public.key_loans;v_action text:=upper(btrim(p_action));
 v_next public.key_loan_status;v_incident public.incident_type;v_incident_id uuid;v_now timestamptz:=now();v_key_updated integer;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
 if v_action not in('CHECKED_OUT','RETURNED','LOST','DAMAGED') then raise exception 'INVALID_KEY_ACTION';end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND';end if;
 if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501';end if;

 if v_action='CHECKED_OUT' then
  if v_loan.status<>'APPROVED' then raise exception 'INVALID_KEY_LOAN_TRANSITION';end if;
  perform pg_advisory_xact_lock(hashtextextended(v_loan.room_id::text,4));
  if exists(select 1 from public.key_loans l where l.room_id=v_loan.room_id and l.id<>v_loan.id and l.status in('CHECKED_OUT','LATE')) then raise exception 'ROOM_KEY_ALREADY_CHECKED_OUT' using errcode='23505';end if;
  if v_loan.key_id is not null then
   update public.room_keys set status='CHECKED_OUT',updated_at=v_now where id=v_loan.key_id and active and status in('AVAILABLE','RESERVED');
   get diagnostics v_key_updated=row_count;
   if v_key_updated<>1 then raise exception 'ROOM_KEY_NOT_AVAILABLE';end if;
  end if;
  update public.key_loans set status='CHECKED_OUT',checked_out_at=v_now,checked_out_by=v_actor where id=p_key_loan_id;
  v_next:='CHECKED_OUT';
 elsif v_action='RETURNED' then
  if v_loan.status not in('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION';end if;
  update public.key_loans set status='RETURNED',user_reported_return_at=v_now,return_confirmed_by=v_actor,returned_at=v_now,returned_to=v_actor where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status='AVAILABLE',updated_at=v_now where id=v_loan.key_id;end if;
  v_next:='RETURNED';
 else
  if v_loan.status not in('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION';end if;
  if nullif(btrim(p_description),'') is null then raise exception 'ISSUE_DESCRIPTION_REQUIRED';end if;
  v_next:=v_action::public.key_loan_status;v_incident:=v_action::public.incident_type;
  update public.key_loans set status=v_next,notes=btrim(p_description) where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status=v_action::public.key_status,updated_at=v_now where id=v_loan.key_id;end if;
  insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
  values(v_loan.key_id,p_key_loan_id,v_actor,v_actor,v_incident,btrim(p_description)) returning id into v_incident_id;
 end if;

 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
 values(p_key_loan_id,v_loan.status,v_next,v_actor,coalesce(nullif(btrim(p_description),''),'User completed '||v_action));
 perform public.write_audit(v_actor,'KEY_STATUS_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('action',v_action,'status',v_next,'incident_id',v_incident_id,'self_service',true));
 return jsonb_build_object('id',p_key_loan_id,'status',v_next,'reported_at',v_now,'late',v_action='RETURNED' and v_loan.expected_return_at is not null and v_now>v_loan.expected_return_at);
end $$;

create or replace function public.get_room_slot_permissions(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz)
returns table(can_book boolean,can_request_key boolean,booking_reason text,key_reason text,class_schedule_id uuid,own_booking_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_start_local timestamp:=p_starts_at at time zone 'Asia/Bangkok';v_end_local timestamp:=p_ends_at at time zone 'Asia/Bangkok';v_schedule uuid;v_booking public.bookings;v_other boolean:=false;v_held boolean;v_policy public.room_usage_policies;v_student boolean;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE';end if;
 if not exists(select 1 from public.rooms where id=p_room_id and active and booking_enabled) then raise exception 'ROOM_NOT_AVAILABLE';end if;
 select * into v_policy from public.room_usage_policies where room_id=p_room_id;v_student:=public.has_role('STUDENT');
 select exists(select 1 from public.key_loans l where l.room_id=p_room_id and l.status in('CHECKED_OUT','LATE')) into v_held;
 select s.id into v_schedule from public.class_schedules s where s.room_id=p_room_id and s.active and s.status='ACTIVE' and s.schedule_type='CLASS' and s.day_of_week=extract(dow from v_start_local)::smallint and v_start_local::date between s.effective_from and s.effective_until and tsrange(date '2000-01-01'+s.start_time,date '2000-01-01'+s.end_time,'[)')&&tsrange(date '2000-01-01'+v_start_local::time,date '2000-01-01'+v_end_local::time,'[)') limit 1;
 select * into v_booking from public.bookings b where b.room_id=p_room_id and (b.requester_id=v_actor or b.beneficiary_user_id=v_actor) and b.status in('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)') order by b.created_at desc limit 1;
 select exists(select 1 from public.bookings b where b.room_id=p_room_id and b.requester_id<>v_actor and b.beneficiary_user_id is distinct from v_actor and b.status in('PENDING','APPROVED','IN_USE') and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) into v_other;
 class_schedule_id:=v_schedule;own_booking_id:=v_booking.id;
 if v_schedule is not null then can_book:=false;booking_reason:='ช่วงเวลานี้มีตารางเรียน';can_request_key:=not v_held and (not v_student or coalesce(v_policy.student_class_key,true));key_reason:=case when v_held then 'ขณะนี้มีผู้ถือกุญแจห้องนี้อยู่' when can_request_key then null else 'ห้องนี้ไม่อนุญาตให้ Student เบิกกุญแจจากคาบเรียน' end;
 elsif v_booking.id is not null then can_book:=false;booking_reason:='คุณมีรายการจองช่วงเวลานี้แล้ว';can_request_key:=not v_held and v_booking.status in('APPROVED','IN_USE') and (not v_student or coalesce(v_policy.student_own_booking_key,true)) and (v_booking.starts_at at time zone 'Asia/Bangkok')::date<=(now() at time zone 'Asia/Bangkok')::date and not exists(select 1 from public.key_loans where booking_id=v_booking.id and status in('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED'));key_reason:=case when v_held then 'ขณะนี้มีผู้ถือกุญแจห้องนี้อยู่' when v_booking.status='PENDING' then 'รอผู้ดูแลอนุมัติการจองก่อน' when (v_booking.starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then 'สามารถเบิกกุญแจได้เมื่อถึงวันที่จอง' when can_request_key then null else 'ไม่มีสิทธิ์หรือมีคำขอเบิกกุญแจแล้ว' end;
 elsif v_other then can_book:=false;can_request_key:=false;booking_reason:='ช่วงเวลานี้มีผู้จองแล้ว';key_reason:='ไม่สามารถเบิกกุญแจจากการจองของผู้อื่น';
 else can_book:=not v_student or coalesce(v_policy.student_book_empty,true);can_request_key:=false;booking_reason:=case when can_book then null else 'ห้องนี้ไม่อนุญาตให้ Student จอง' end;key_reason:=case when v_held then 'ขณะนี้มีผู้ถือกุญแจห้องนี้อยู่' else 'ต้องจองห้องและรออนุมัติก่อน' end;end if;return next;
end $$;

create or replace function public.get_admin_key_cabinet()
returns table(room_id uuid,room_code text,room_name text,room_active boolean,key_status text,available_keys bigint,held_keys bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query select r.id,r.code,r.name,r.active,
  case when not r.active then 'ROOM_CLOSED' when exists(select 1 from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE')) then 'CHECKED_OUT' else 'AVAILABLE' end,
  count(k.id) filter(where k.active and k.status='AVAILABLE'),
  (select count(*) from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE'))
 from public.rooms r left join public.room_keys k on k.room_id=r.id group by r.id order by r.code;
end $$;

revoke all on function public.report_key_status(uuid,text,text),public.get_admin_key_cabinet() from public,anon;
grant execute on function public.report_key_status(uuid,text,text),public.get_admin_key_cabinet() to authenticated;
-- END SOURCE: 0024_self_service_key_return.sql
commit;

begin;
-- BEGIN SOURCE: 0025_self_service_booking_key_approval.sql
-- Booking-derived key requests are automatically approved for borrower self-service.
insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
select l.id,'REQUESTED','APPROVED',l.requested_by,'Automatically approved by self-service migration'
from public.key_loans l join public.bookings b on b.id=l.booking_id
where l.usage_source='BOOKING' and l.status='REQUESTED' and b.status in('APPROVED','IN_USE');

select public.write_audit(l.requested_by,'KEY_REQUEST_AUTO_APPROVED','key_loan',l.id,jsonb_build_object('booking_id',l.booking_id,'migration','0025'))
from public.key_loans l join public.bookings b on b.id=l.booking_id
where l.usage_source='BOOKING' and l.status='REQUESTED' and b.status in('APPROVED','IN_USE');

update public.key_loans l set status='APPROVED',approved_at=now(),approved_by=l.requested_by,authorized_by=l.requested_by,
 expected_return_at=coalesce(l.expected_return_at,b.ends_at)
from public.bookings b where b.id=l.booking_id and l.usage_source='BOOKING' and l.status='REQUESTED' and b.status in('APPROVED','IN_USE');

create or replace function public.ensure_key_request_for_booking()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_loan_id uuid;v_borrower uuid;
begin
 if new.status='APPROVED' and new.requires_key and (tg_op='INSERT' or old.status is distinct from new.status)
    and not exists(select 1 from public.key_loans where booking_id=new.id and status in('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')) then
  v_borrower:=coalesce(new.beneficiary_user_id,new.requester_id);
  insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,expected_return_at)
  values(new.id,new.room_id,'BOOKING',v_borrower,new.requester_id,new.requester_id,'APPROVED',now(),new.requester_id,new.ends_at) returning id into v_loan_id;
  insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan_id,'APPROVED',new.requester_id,'Automatically approved with booking');
  perform public.write_audit(new.requester_id,'KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan_id,jsonb_build_object('booking_id',new.id));
 end if;
 return new;
end $$;

create or replace function public.request_booking_key(p_booking_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;v_loan public.key_loans;v_policy public.room_usage_policies;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND';end if;
 if v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if v_booking.status not in('APPROVED','IN_USE') then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY';end if;
 if (v_booking.starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then raise exception 'KEY_NOT_AVAILABLE_BEFORE_BOOKING_DATE';end if;
 select * into v_policy from public.room_usage_policies where room_id=v_booking.room_id;
 if public.has_role('STUDENT') and not coalesce(v_policy.student_own_booking_key,true) then raise exception 'KEY_POLICY_DENIED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_booking.room_id::text,4));
 if exists(select 1 from public.key_loans l where l.room_id=v_booking.room_id and l.status in('CHECKED_OUT','LATE')) then raise exception 'ROOM_KEY_ALREADY_CHECKED_OUT' using errcode='23505';end if;
 update public.bookings set requires_key=true where id=p_booking_id;
 insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,expected_return_at,notes)
 values(p_booking_id,v_booking.room_id,'BOOKING',coalesce(v_booking.beneficiary_user_id,v_booking.requester_id),v_actor,v_actor,'APPROVED',now(),v_actor,v_booking.ends_at,nullif(btrim(p_notes),'')) returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'APPROVED',v_actor,'Automatically approved from owned booking');
 perform public.write_audit(v_actor,'KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));
 return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';
end $$;

revoke all on function public.request_booking_key(uuid,text) from public,anon;
grant execute on function public.request_booking_key(uuid,text) to authenticated;
-- END SOURCE: 0025_self_service_booking_key_approval.sql
commit;

begin;
-- BEGIN SOURCE: 0026_extend_booking_close_time.sql
-- The final visible 17:30 slot represents 17:30-18:30, so the booking window must end at 18:30.
insert into public.booking_rules(rule_key,rule_value,description,active,updated_at)
values('GENERAL_CLOSE_TIME','"18:30"','Confirmed local closing time; permits the final 17:30-18:30 slot in Asia/Bangkok',true,now())
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description,active=true,updated_at=now();
-- END SOURCE: 0026_extend_booking_close_time.sql
commit;

begin;
-- BEGIN SOURCE: 0027_finalize_expired_bookings.sql
-- Reconcile elapsed bookings without guessing whether the room was actually used.
create or replace function public.reconcile_expired_bookings()
returns integer language plpgsql security definer set search_path='' as $$
declare v_booking public.bookings;v_count integer:=0;
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 for v_booking in select * from public.bookings where status in('APPROVED','IN_USE') and ends_at<=now() for update skip locked loop
  update public.bookings set status='COMPLETED',updated_at=now() where id=v_booking.id;
  insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason)
  values(v_booking.id,v_booking.status,'COMPLETED',null,'Booking end time elapsed');
  perform public.write_audit(null,'BOOKING_AUTO_COMPLETED','booking',v_booking.id,jsonb_build_object('previous_status',v_booking.status,'ends_at',v_booking.ends_at));
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;

create or replace function public.cancel_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED';end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND';end if;
 if v_booking.requester_id<>v_actor and not public.has_permission('BOOKING_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if v_booking.ends_at<=now() then raise exception 'BOOKING_ALREADY_ENDED' using errcode='22023';end if;
 if v_booking.status not in('PENDING','APPROVED') then raise exception 'INVALID_BOOKING_TRANSITION';end if;
 update public.bookings set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason=btrim(p_reason) where id=p_booking_id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,v_booking.status,'CANCELLED',v_actor,btrim(p_reason));
 perform public.create_notification(v_booking.requester_id,'BOOKING_CANCELLED','Booking cancelled','Booking '||v_booking.booking_code||' was cancelled.','booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_CANCELLED','booking',p_booking_id,jsonb_build_object('reason',btrim(p_reason)));
 return jsonb_build_object('id',p_booking_id,'status','CANCELLED');
end $$;

revoke all on function public.reconcile_expired_bookings(),public.cancel_booking(uuid,text) from public,anon;
grant execute on function public.reconcile_expired_bookings(),public.cancel_booking(uuid,text) to authenticated;
-- END SOURCE: 0027_finalize_expired_bookings.sql
commit;

begin;
-- BEGIN SOURCE: 0028_overdue_key_cabinet_and_borrower_identity.sql
-- Distinguish an active checkout from an overdue key and expose safe borrower identity to Admin.
create or replace view public.admin_key_activity_v with (security_invoker=true) as
select l.*,k.key_code,r.code room_code,r.name room_name,
 (l.status='RETURN_REPORTED' and l.expected_return_at is not null and l.user_reported_return_at>l.expected_return_at) returned_late,
 nullif(btrim(p.full_name),'') borrower_full_name,
 nullif(btrim(p.university_id),'') borrower_university_id,
 p.email borrower_email
from public.key_loans l
left join public.room_keys k on k.id=l.key_id
join public.rooms r on r.id=l.room_id
join public.profiles p on p.id=l.borrower_id;

grant select on public.admin_key_activity_v to authenticated;

create or replace function public.get_admin_key_cabinet()
returns table(room_id uuid,room_code text,room_name text,room_active boolean,key_status text,available_keys bigint,held_keys bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('ROOM_MANAGE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 return query
 select r.id,r.code,r.name,r.active,
  case
   when exists(
    select 1 from public.key_loans l
    where l.room_id=r.id and l.status in('CHECKED_OUT','LATE')
     and (l.status='LATE' or (l.expected_return_at is not null and l.expected_return_at<=now()))
   ) then 'OVERDUE'
   when not r.active then 'ROOM_CLOSED'
   when exists(
    select 1 from public.key_loans l
    where l.room_id=r.id and l.status in('CHECKED_OUT','LATE')
   ) then 'CHECKED_OUT'
   else 'AVAILABLE'
  end,
  count(k.id) filter(where k.active and k.status='AVAILABLE'),
  (select count(*) from public.key_loans l where l.room_id=r.id and l.status in('CHECKED_OUT','LATE'))
 from public.rooms r
 left join public.room_keys k on k.room_id=r.id
 group by r.id
 order by r.code;
end $$;

revoke all on function public.get_admin_key_cabinet() from public,anon;
grant execute on function public.get_admin_key_cabinet() to authenticated;
-- END SOURCE: 0028_overdue_key_cabinet_and_borrower_identity.sql
commit;

begin;
-- BEGIN SOURCE: 0029_baseline_request_schema.sql
-- Approved FR/NFR baseline: additive request-centric schema.
create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.room_types
 add column usage_scope text not null default 'LABORATORY'
   check (usage_scope in ('LABORATORY','MEETING','OTHER')),
 add column requires_sso_for_key_request boolean not null default false,
 add column default_key_approval_mode text not null default 'AUTO'
   check (default_key_approval_mode in ('AUTO','ADMIN'));

update public.room_types
set usage_scope=case when code='MEETING' then 'MEETING' when code in ('COMPUTER','STUDIO','GAMING','ELEARNING','COLD') then 'LABORATORY' else 'OTHER' end,
    requires_sso_for_key_request=code in ('STUDIO','GAMING','ELEARNING'),
    default_key_approval_mode=case when code in ('STUDIO','GAMING','ELEARNING') then 'ADMIN' else 'AUTO' end;

insert into public.roles(code,name,description,system_role) values
 ('DEAN','Dean','Authorized meeting-room personnel',true),
 ('DEPARTMENT_HEAD','Department Head','Authorized meeting-room personnel',true)
on conflict(code) do update set name=excluded.name,description=excluded.description;

alter table public.rooms
 add column key_approval_mode text not null default 'INHERIT'
 check (key_approval_mode in ('INHERIT','AUTO','ADMIN'));

create table public.key_requests (
 id uuid primary key default gen_random_uuid(),
 request_code text not null unique default ('KR-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 room_id uuid not null references public.rooms(id),
 authenticated_user_id uuid references public.profiles(id),
 requester_name text not null check (length(btrim(requester_name)) between 2 and 200),
 requester_email text not null check (lower(requester_email)=requester_email and requester_email ~ '^[^@[:space:]]+@northbkk[.]ac[.]th$'),
 purpose_type text not null check (purpose_type in ('TEACHING','OTHER')),
 purpose text not null check (length(btrim(purpose)) between 2 and 1000),
 course_code text,
 course_name text,
 lecturer_name text,
 lecturer_email text,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 status text not null check (status in ('PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED','IN_USE','RETURNED')),
 approval_mode text not null check (approval_mode in ('AUTO','ADMIN')),
 submitted_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references public.profiles(id),
 decision_reason text,
 cancelled_at timestamptz,
 returned_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint key_requests_time_order check (ends_at>starts_at),
 constraint key_requests_same_bangkok_day check ((starts_at at time zone 'Asia/Bangkok')::date=(ends_at at time zone 'Asia/Bangkok')::date),
 constraint key_requests_service_hours check ((starts_at at time zone 'Asia/Bangkok')::time>=time '08:00' and (ends_at at time zone 'Asia/Bangkok')::time<=time '18:00'),
 constraint key_requests_teaching_fields check (
  purpose_type<>'TEACHING' or (
   nullif(btrim(course_code),'') is not null and nullif(btrim(course_name),'') is not null and
   nullif(btrim(lecturer_name),'') is not null and nullif(btrim(lecturer_email),'') is not null and
   lower(lecturer_email) ~ '^[^@[:space:]]+@northbkk[.]ac[.]th$'
  )
 ),
 constraint key_requests_decision_fields check (
  (status not in ('REJECTED') or (decided_at is not null and decided_by is not null and nullif(btrim(decision_reason),'') is not null))
 )
);

alter table public.key_requests add constraint no_overlapping_active_key_requests
 exclude using gist (room_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
 where (status in ('PENDING_APPROVAL','APPROVED','IN_USE'));

create index key_requests_room_time_idx on public.key_requests(room_id,starts_at,ends_at);
create index key_requests_requester_idx on public.key_requests(authenticated_user_id,created_at desc) where authenticated_user_id is not null;
create index key_requests_status_idx on public.key_requests(status,starts_at);

create table public.key_request_status_history (
 id bigint generated always as identity primary key,
 key_request_id uuid not null references public.key_requests(id),
 previous_status text,
 new_status text not null,
 actor_user_id uuid references public.profiles(id),
 actor_kind text not null check (actor_kind in ('ANONYMOUS','USER','ADMIN','SYSTEM','TOKEN')),
 reason text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index key_request_status_history_request_idx on public.key_request_status_history(key_request_id,created_at);

create table public.secure_action_tokens (
 id uuid primary key default gen_random_uuid(),
 key_request_id uuid not null references public.key_requests(id),
 action text not null check (action in ('TRACK','CANCEL','RETURN')),
 token_digest bytea not null,
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now(),
 constraint secure_action_tokens_digest_key unique(token_digest),
 constraint secure_action_tokens_expiry check (expires_at>created_at)
);
create index secure_action_tokens_request_idx on public.secure_action_tokens(key_request_id,action,expires_at);

create table public.notification_outbox (
 id uuid primary key default gen_random_uuid(),
 notification_type text not null,
 recipient_email text not null,
 entity_type text not null,
 entity_id uuid not null,
 template_key text not null,
 payload jsonb not null default '{}'::jsonb,
 scheduled_at timestamptz not null default now(),
 status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','SENT','FAILED','DEAD','CANCELLED')),
 attempt_count integer not null default 0 check (attempt_count>=0),
 max_attempts integer not null default 5 check (max_attempts between 1 and 20),
 next_attempt_at timestamptz not null default now(),
 locked_at timestamptz,
 lease_expires_at timestamptz,
 locked_by text,
 sent_at timestamptz,
 provider_message_id text,
 last_error text,
 idempotency_key text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint notification_outbox_idempotency_key_key unique(idempotency_key)
);
create index notification_outbox_claim_idx on public.notification_outbox(next_attempt_at,scheduled_at)
 where status in ('PENDING','FAILED');

create table public.booking_segments (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid not null references public.bookings(id),
 room_id uuid not null references public.rooms(id),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 segment_status text not null default 'ACTIVE' check (segment_status in ('ACTIVE','SUPERSEDED','CANCELLED')),
 displaced_by_booking_id uuid references public.bookings(id),
 displacement_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint booking_segments_time_order check (ends_at>starts_at),
 constraint booking_segments_displacement check ((segment_status='SUPERSEDED')=(displaced_by_booking_id is not null))
);
alter table public.bookings add column origin_booking_id uuid references public.bookings(id);
create index booking_segments_booking_idx on public.booking_segments(booking_id,starts_at);
create index booking_segments_room_idx on public.booking_segments using gist(room_id,tstzrange(starts_at,ends_at,'[)')) where segment_status='ACTIVE';

create table public.sync_runs (
 id uuid primary key default gen_random_uuid(),
 source_type text not null check (source_type in ('ROOMS','SCHEDULES')),
 source_reference text,
 status text not null default 'RUNNING' check (status in ('RUNNING','SUCCEEDED','PARTIAL','FAILED')),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 inserted_count integer not null default 0,
 updated_count integer not null default 0,
 unchanged_count integer not null default 0,
 error_count integer not null default 0,
 checksum text,
 metadata jsonb not null default '{}'::jsonb,
 constraint sync_runs_completion check ((status='RUNNING' and completed_at is null) or (status<>'RUNNING' and completed_at is not null))
);

create table public.sync_change_impacts (
 id bigint generated always as identity primary key,
 sync_run_id uuid not null references public.sync_runs(id),
 room_id uuid references public.rooms(id),
 booking_id uuid references public.bookings(id),
 change_type text not null,
 details jsonb not null default '{}'::jsonb,
 admin_notified_at timestamptz,
 created_at timestamptz not null default now()
);
create index sync_change_impacts_run_idx on public.sync_change_impacts(sync_run_id,created_at);

create table public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check (length(btrim(title)) between 1 and 200),
 body text not null check (length(btrim(body)) between 1 and 5000),
 audience text not null default 'SPECIAL_ROOM_USERS' check (audience in ('SPECIAL_ROOM_USERS','ALL_AUTHENTICATED')),
 active boolean not null default true,
 visible_from timestamptz not null default now(),
 visible_until timestamptz,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint announcements_visibility_range check (visible_until is null or visible_until>visible_from)
);

alter table public.key_requests enable row level security;
alter table public.key_request_status_history enable row level security;
alter table public.secure_action_tokens enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.booking_segments enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_change_impacts enable row level security;
alter table public.announcements enable row level security;

create trigger set_key_requests_updated_at before update on public.key_requests
for each row execute function public.set_updated_at();
create trigger set_notification_outbox_updated_at before update on public.notification_outbox
for each row execute function public.set_updated_at();
create trigger set_booking_segments_updated_at before update on public.booking_segments
for each row execute function public.set_updated_at();
create trigger set_announcements_updated_at before update on public.announcements
for each row execute function public.set_updated_at();

insert into public.booking_rules(rule_key,rule_value,description,active) values
 ('BASELINE_SERVICE_OPEN_TIME','"08:00"'::jsonb,'Approved baseline local opening time in Asia/Bangkok',true),
 ('BASELINE_SERVICE_CLOSE_TIME','"18:00"'::jsonb,'Approved baseline local closing time in Asia/Bangkok',true),
 ('MEETING_ADVANCE_BOOKING_DAYS','3'::jsonb,'Approved default; starts tomorrow and skips Saturday',true),
 ('PUBLIC_KEY_HISTORY_IDENTITY_ENABLED','false'::jsonb,'Privacy gate: full public name/email remains disabled pending confirmation',true)
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description,active=true,updated_at=now();
-- END SOURCE: 0029_baseline_request_schema.sql
commit;

begin;
-- BEGIN SOURCE: 0030_baseline_workflow_functions.sql
-- Transactional workflow RPCs for the approved FR/NFR baseline.

create or replace function public.append_key_request_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.key_request_status_history(key_request_id,new_status,actor_user_id,actor_kind,reason)
  values(new.id,new.status,new.authenticated_user_id,case when new.authenticated_user_id is null then 'ANONYMOUS' else 'USER' end,'Request submitted');
 elsif new.status is distinct from old.status then
  insert into public.key_request_status_history(key_request_id,previous_status,new_status,actor_user_id,actor_kind,reason)
  values(new.id,old.status,new.status,coalesce(new.decided_by,new.authenticated_user_id),
   coalesce(nullif(current_setting('app.key_request_actor_kind',true),''),
    case when new.decided_by is not null then 'ADMIN' when new.authenticated_user_id is not null then 'USER' else 'SYSTEM' end),
   coalesce(new.decision_reason,'Status changed'));
 end if;
 return new;
end $$;

create or replace function public.update_room_key_approval_mode(p_room_id uuid,p_mode text)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_mode text:=upper(btrim(p_mode));v_before text;
begin
 if v_actor is null or not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if v_mode not in('INHERIT','AUTO','ADMIN') then raise exception 'INVALID_APPROVAL_MODE';end if;
 select key_approval_mode into v_before from public.rooms where id=p_room_id for update;
 if not found then raise exception 'ROOM_NOT_FOUND';end if;
 update public.rooms set key_approval_mode=v_mode where id=p_room_id;
 perform public.write_audit(v_actor,'ROOM_KEY_APPROVAL_MODE_CHANGED','room',p_room_id,jsonb_build_object('before',v_before,'after',v_mode));
end $$;

create or replace function public.create_meeting_booking(
 p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_booking public.bookings;v_today date:=(now() at time zone 'Asia/Bangkok')::date;
 v_allowed_until date:=v_today;v_days integer:=0;v_limit integer:=3;v_start_local timestamp;v_end_local timestamp;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
 if nullif(btrim(p_purpose),'') is null or p_ends_at<=p_starts_at then raise exception 'INVALID_BOOKING_INPUT';end if;
 if not exists(select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=p_room_id and r.active and r.booking_enabled and rt.usage_scope='MEETING') then raise exception 'MEETING_ROOM_NOT_AVAILABLE';end if;
 select coalesce((rule_value#>>'{}')::integer,3) into v_limit from public.booking_rules
 where rule_key='MEETING_ADVANCE_BOOKING_DAYS' and active;
 v_limit:=coalesce(v_limit,3);
 while v_days<v_limit loop
  v_allowed_until:=v_allowed_until+1;
  if extract(dow from v_allowed_until)<>6 then v_days:=v_days+1;end if;
 end loop;
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok';v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 if v_start_local::date<v_today+1 or v_start_local::date>v_allowed_until then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED';end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<time '08:00' or v_end_local::time>time '18:00' then raise exception 'OUTSIDE_SERVICE_HOURS';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text||':'||v_start_local::date::text,338));
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then
  raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';
 end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,notes,status,requires_key,is_priority)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),p_notes,'APPROVED',false,public.has_permission('BOOKING_OVERRIDE'))
 returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason)
 values(v_booking.id,'APPROVED',v_actor,'Meeting booking automatically confirmed by approved baseline');
 perform public.write_audit(v_actor,'MEETING_BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id));
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.enforce_meeting_booking_role()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_scope text;
begin
 select rt.usage_scope into v_scope from public.rooms r join public.room_types rt on rt.id=r.room_type_id where r.id=new.room_id;
 if v_scope='MEETING' and new.status in('PENDING','APPROVED','IN_USE') and coalesce(auth.role(),'')<>'service_role'
  and not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 return new;
end $$;
create trigger enforce_meeting_booking_role before insert or update of room_id,status on public.bookings
for each row execute function public.enforce_meeting_booking_role();

create or replace function public.upsert_announcement(
 p_id uuid,p_title text,p_body text,p_audience text,p_active boolean,p_visible_from timestamptz,p_visible_until timestamptz
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_id uuid:=coalesce(p_id,extensions.gen_random_uuid());
begin
 if v_actor is null or not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_id is null then
  insert into public.announcements(id,title,body,audience,active,visible_from,visible_until,created_by)
  values(v_id,btrim(p_title),btrim(p_body),upper(btrim(p_audience)),p_active,p_visible_from,p_visible_until,v_actor);
 else
  update public.announcements set title=btrim(p_title),body=btrim(p_body),audience=upper(btrim(p_audience)),
   active=p_active,visible_from=p_visible_from,visible_until=p_visible_until where id=p_id;
  if not found then raise exception 'ANNOUNCEMENT_NOT_FOUND';end if;
 end if;
 perform public.write_audit(v_actor,case when p_id is null then 'ANNOUNCEMENT_CREATED' else 'ANNOUNCEMENT_UPDATED' end,
  'announcement',v_id,jsonb_build_object('active',p_active,'audience',upper(btrim(p_audience))));
 return v_id;
end $$;

create trigger append_key_request_history
after insert or update of status on public.key_requests
for each row execute function public.append_key_request_history();

create or replace function public.create_key_request(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_purpose_type text,p_purpose text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_course_code text default null,p_course_name text default null,
 p_lecturer_name text default null,p_lecturer_email text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_type public.room_types;v_request public.key_requests;v_room_mode text;v_profile public.profiles;
 v_today date:=(now() at time zone 'Asia/Bangkok')::date;
begin
 if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE';end if;
 if (p_starts_at at time zone 'Asia/Bangkok')::date<>v_today or (p_ends_at at time zone 'Asia/Bangkok')::date<>v_today then
  raise exception 'KEY_REQUEST_CURRENT_DAY_ONLY';
 end if;
 if (p_starts_at at time zone 'Asia/Bangkok')::time<time '08:00' or (p_ends_at at time zone 'Asia/Bangkok')::time>time '18:00' then
  raise exception 'OUTSIDE_SERVICE_HOURS';
 end if;
 select rt.* into v_type from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 where r.id=p_room_id and r.active and r.booking_enabled for share of r;
 if not found or v_type.usage_scope<>'LABORATORY' then raise exception 'ROOM_NOT_AVAILABLE';end if;
 if v_type.requires_sso_for_key_request and v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select r.key_approval_mode into v_room_mode from public.rooms r where r.id=p_room_id;
 if v_actor is not null then
  select * into v_profile from public.profiles p where p.id=v_actor and p.account_status='ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
  if v_type.requires_sso_for_key_request then
   p_requester_name:=v_profile.full_name;p_requester_email:=v_profile.email;
  end if;
 end if;

 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,336));
 if exists(
  select 1 from public.key_loans l left join public.bookings b on b.id=l.booking_id
  where l.room_id=p_room_id and l.status in('REQUESTED','APPROVED','CHECKED_OUT','LATE')
   and tstzrange(coalesce(b.starts_at,l.checked_out_at,l.requested_at),coalesce(b.ends_at,l.expected_return_at,l.requested_at+interval '1 minute'),'[)')
    &&tstzrange(p_starts_at,p_ends_at,'[)')
 ) then raise exception 'LEGACY_KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';end if;
 begin
  insert into public.key_requests(
   room_id,authenticated_user_id,requester_name,requester_email,purpose_type,purpose,
   course_code,course_name,lecturer_name,lecturer_email,starts_at,ends_at,status,approval_mode
  ) values(
   p_room_id,v_actor,btrim(p_requester_name),lower(btrim(p_requester_email)),upper(btrim(p_purpose_type)),btrim(p_purpose),
   nullif(btrim(p_course_code),''),nullif(btrim(p_course_name),''),nullif(btrim(p_lecturer_name),''),lower(nullif(btrim(p_lecturer_email),'')),
   p_starts_at,p_ends_at,case when coalesce(nullif(v_room_mode,'INHERIT'),v_type.default_key_approval_mode)='AUTO' then 'APPROVED' else 'PENDING_APPROVAL' end,
   coalesce(nullif(v_room_mode,'INHERIT'),v_type.default_key_approval_mode)
  ) returning * into v_request;
 exception when exclusion_violation then
  raise exception 'KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';
 end;

 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 values('KEY_REQUEST_SUBMITTED',v_request.requester_email,'key_request',v_request.id,'key-request-submitted',
  jsonb_build_object('request_code',v_request.request_code,'status',v_request.status,'action_bundle_required',true),
  'key-request:'||v_request.id||':submitted') on conflict(idempotency_key) do nothing;
 if v_request.purpose_type='TEACHING' and v_request.lecturer_email is not null then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
  values('KEY_REQUEST_LECTURER_NOTICE',v_request.lecturer_email,'key_request',v_request.id,'key-request-lecturer-notice',
   jsonb_build_object('request_code',v_request.request_code),
   'key-request:'||v_request.id||':lecturer-submitted') on conflict(idempotency_key) do nothing;
 end if;
 perform public.write_audit(v_actor,'KEY_REQUEST_CREATED','key_request',v_request.id,
  jsonb_build_object('room_id',p_room_id,'status',v_request.status,'anonymous',v_actor is null));
 return jsonb_build_object('id',v_request.id,'request_code',v_request.request_code,'status',v_request.status);
end $$;

create or replace function public.decide_key_request(p_key_request_id uuid,p_decision text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_request public.key_requests;v_next text:=upper(btrim(p_decision));
begin
 if v_actor is null or not(public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_APPROVE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if v_next not in('APPROVED','REJECTED') then raise exception 'INVALID_DECISION';end if;
 if v_next='REJECTED' and nullif(btrim(p_reason),'') is null then raise exception 'REASON_REQUIRED';end if;
 select * into v_request from public.key_requests where id=p_key_request_id for update;
 if not found then raise exception 'KEY_REQUEST_NOT_FOUND';end if;
 if v_request.status<>'PENDING_APPROVAL' then raise exception 'KEY_REQUEST_NOT_PENDING';end if;
 update public.key_requests set status=v_next,decided_at=now(),decided_by=v_actor,decision_reason=nullif(btrim(p_reason),'')
 where id=p_key_request_id returning * into v_request;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 values('KEY_REQUEST_'||v_next,v_request.requester_email,'key_request',v_request.id,'key-request-'||lower(v_next),
  jsonb_build_object('request_code',v_request.request_code,'reason',v_request.decision_reason),
  'key-request:'||v_request.id||':decision:'||lower(v_next)) on conflict(idempotency_key) do nothing;
 perform public.write_audit(v_actor,'KEY_REQUEST_'||v_next,'key_request',v_request.id,jsonb_build_object('reason',v_request.decision_reason));
 return jsonb_build_object('id',v_request.id,'status',v_request.status);
end $$;

create or replace function public.register_key_request_action_token(
 p_key_request_id uuid,p_action text,p_raw_token text,p_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_action text:=upper(btrim(p_action));
begin
 if coalesce(auth.role(),'')<>'service_role' and (auth.uid() is null or not public.has_permission('KEY_MANAGE')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if v_action not in('TRACK','CANCEL','RETURN') then raise exception 'INVALID_TOKEN_ACTION';end if;
 if length(p_raw_token)<32 then raise exception 'TOKEN_TOO_SHORT';end if;
 if p_expires_at<=now() then raise exception 'TOKEN_ALREADY_EXPIRED';end if;
 insert into public.secure_action_tokens(key_request_id,action,token_digest,expires_at)
 values(p_key_request_id,v_action,extensions.digest(convert_to(p_raw_token,'UTF8'),'sha256'),p_expires_at) returning id into v_id;
 return v_id;
end $$;

create or replace function public.issue_key_request_action_bundle(p_key_request_id uuid,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_track text;v_cancel text;v_return text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_expires_at<=now() then raise exception 'TOKEN_ALREADY_EXPIRED';end if;
 if not exists(select 1 from public.key_requests where id=p_key_request_id) then raise exception 'KEY_REQUEST_NOT_FOUND';end if;
 v_track:=extensions.encode(extensions.gen_random_bytes(32),'hex');
 v_cancel:=extensions.encode(extensions.gen_random_bytes(32),'hex');
 v_return:=extensions.encode(extensions.gen_random_bytes(32),'hex');
 insert into public.secure_action_tokens(key_request_id,action,token_digest,expires_at) values
  (p_key_request_id,'TRACK',extensions.digest(convert_to(v_track,'UTF8'),'sha256'),p_expires_at),
  (p_key_request_id,'CANCEL',extensions.digest(convert_to(v_cancel,'UTF8'),'sha256'),p_expires_at),
  (p_key_request_id,'RETURN',extensions.digest(convert_to(v_return,'UTF8'),'sha256'),p_expires_at);
 return jsonb_build_object('track_token',v_track,'cancel_token',v_cancel,'return_token',v_return,'expires_at',p_expires_at);
end $$;

create or replace function public.consume_key_request_action(p_raw_token text,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token public.secure_action_tokens;v_request public.key_requests;v_action text:=upper(btrim(p_action));
begin
 select * into v_token from public.secure_action_tokens
 where token_digest=extensions.digest(convert_to(p_raw_token,'UTF8'),'sha256') and action=v_action for update;
 if not found then raise exception 'INVALID_ACTION_TOKEN' using errcode='42501';end if;
 if v_token.used_at is not null then raise exception 'ACTION_TOKEN_ALREADY_USED' using errcode='42501';end if;
 if v_token.expires_at<=now() then raise exception 'ACTION_TOKEN_EXPIRED' using errcode='42501';end if;
 select * into v_request from public.key_requests where id=v_token.key_request_id for update;
 if not found then raise exception 'KEY_REQUEST_NOT_FOUND';end if;

 if v_action='TRACK' then
  update public.secure_action_tokens set used_at=now() where id=v_token.id;
  return jsonb_build_object('request_code',v_request.request_code,'status',v_request.status,'starts_at',v_request.starts_at,'ends_at',v_request.ends_at);
 elsif v_action='CANCEL' then
  if v_request.status not in('PENDING_APPROVAL','APPROVED','IN_USE') or now()>=v_request.ends_at then raise exception 'KEY_REQUEST_NOT_CANCELLABLE';end if;
  perform set_config('app.key_request_actor_kind','TOKEN',true);
  update public.key_requests set status='CANCELLED',cancelled_at=now() where id=v_request.id returning * into v_request;
 elsif v_action='RETURN' then
  if v_request.status not in('APPROVED','IN_USE') or now()<v_request.starts_at then raise exception 'KEY_REQUEST_NOT_RETURNABLE';end if;
  perform set_config('app.key_request_actor_kind','TOKEN',true);
  update public.key_requests set status='RETURNED',returned_at=now() where id=v_request.id returning * into v_request;
 else raise exception 'INVALID_TOKEN_ACTION';
 end if;
 update public.secure_action_tokens set used_at=now() where id=v_token.id;
 perform public.write_audit(null,'KEY_REQUEST_TOKEN_'||v_action,'key_request',v_request.id,jsonb_build_object('token_id',v_token.id));
 return jsonb_build_object('request_code',v_request.request_code,'status',v_request.status,'effective_at',now());
end $$;

insert into public.booking_segments(booking_id,room_id,starts_at,ends_at,segment_status)
select b.id,b.room_id,b.starts_at,b.ends_at,'ACTIVE' from public.bookings b
where b.status in('PENDING','APPROVED','IN_USE') and not exists(select 1 from public.booking_segments s where s.booking_id=b.id);

create or replace function public.ensure_booking_segment()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in('PENDING','APPROVED','IN_USE') then
  insert into public.booking_segments(booking_id,room_id,starts_at,ends_at)
  select new.id,new.room_id,new.starts_at,new.ends_at
  where not exists(select 1 from public.booking_segments where booking_id=new.id);
 end if;
 return new;
end $$;
create trigger ensure_booking_segment after insert on public.bookings
for each row execute function public.ensure_booking_segment();

create or replace function public.sync_booking_segments()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.room_id is distinct from new.room_id or old.starts_at is distinct from new.starts_at or old.ends_at is distinct from new.ends_at then
  if exists(select 1 from public.booking_segments where booking_id=old.id and segment_status='SUPERSEDED') then
   raise exception 'SEGMENTED_BOOKING_REQUIRES_SEGMENT_AWARE_EDIT';
  end if;
  update public.booking_segments set room_id=new.room_id,starts_at=new.starts_at,ends_at=new.ends_at
  where booking_id=new.id and segment_status='ACTIVE';
 end if;
 if old.status is distinct from new.status and new.status not in('PENDING','APPROVED','IN_USE')
  and current_setting('app.priority_override',true) is distinct from 'true' then
  update public.booking_segments set segment_status='CANCELLED' where booking_id=new.id and segment_status='ACTIVE';
 end if;
 return new;
end $$;
create trigger sync_booking_segments before update of room_id,starts_at,ends_at,status on public.bookings
for each row execute function public.sync_booking_segments();

create or replace function public.prevent_legacy_key_overlap_with_baseline()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_start timestamptz;v_end timestamptz;
begin
 if new.status not in('REQUESTED','APPROVED','CHECKED_OUT','LATE') then return new;end if;
 select coalesce(b.starts_at,new.checked_out_at,new.requested_at),coalesce(b.ends_at,new.expected_return_at,new.requested_at+interval '1 minute')
 into v_start,v_end from (select 1) x left join public.bookings b on b.id=new.booking_id;
 perform pg_advisory_xact_lock(hashtextextended(new.room_id::text,336));
 if exists(select 1 from public.key_requests r where r.room_id=new.room_id and r.status in('PENDING_APPROVAL','APPROVED','IN_USE')
  and tstzrange(r.starts_at,r.ends_at,'[)')&&tstzrange(v_start,v_end,'[)')) then
  raise exception 'BASELINE_KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';
 end if;
 return new;
end $$;
create trigger prevent_legacy_key_overlap_with_baseline before insert or update of room_id,status,booking_id,expected_return_at on public.key_loans
for each row execute function public.prevent_legacy_key_overlap_with_baseline();

create or replace function public.create_priority_booking_override(
 p_displaced_booking_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_reason text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_old public.bookings;v_priority public.bookings;v_left uuid;v_right uuid;
begin
 if v_actor is null or not public.has_permission('BOOKING_OVERRIDE') or
  not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_ends_at<=p_starts_at or nullif(btrim(p_purpose),'') is null or nullif(btrim(p_reason),'') is null then raise exception 'INVALID_OVERRIDE_INPUT';end if;
 select * into v_old from public.bookings where id=p_displaced_booking_id for update;
 if not found or v_old.status not in('APPROVED','IN_USE') or v_old.is_priority then raise exception 'BOOKING_NOT_OVERRIDEABLE';end if;
 if not tstzrange(v_old.starts_at,v_old.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)') then raise exception 'BOOKINGS_DO_NOT_OVERLAP';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_old.room_id::text,337));
 perform set_config('app.priority_override','true',true);
 update public.bookings set status='SUPERSEDED',override_reason=btrim(p_reason) where id=v_old.id;
 if exists(select 1 from public.check_room_availability(v_old.room_id,p_starts_at,p_ends_at) where not available) then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,status,is_priority,origin_booking_id)
 values(v_actor,v_actor,v_actor,v_old.room_id,p_starts_at,p_ends_at,btrim(p_purpose),'APPROVED',true,v_old.id) returning * into v_priority;
 update public.bookings set superseded_by_booking_id=v_priority.id where id=v_old.id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason)
 values(v_old.id,v_old.status,'SUPERSEDED',v_actor,btrim(p_reason));
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason)
 values(v_priority.id,'APPROVED',v_actor,'Priority override');
 update public.booking_segments set segment_status='SUPERSEDED',displaced_by_booking_id=v_priority.id,displacement_reason=btrim(p_reason)
 where booking_id=v_old.id and segment_status='ACTIVE';
 if v_old.starts_at<p_starts_at then
  insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,notes,status,requires_key,origin_booking_id)
  values(v_old.requester_id,v_actor,v_old.beneficiary_user_id,v_old.room_id,v_old.starts_at,least(v_old.ends_at,p_starts_at),v_old.purpose,v_old.notes,'APPROVED',v_old.requires_key,v_old.id) returning id into v_left;
 end if;
 if v_old.ends_at>p_ends_at then
  insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,notes,status,requires_key,origin_booking_id)
  values(v_old.requester_id,v_actor,v_old.beneficiary_user_id,v_old.room_id,greatest(v_old.starts_at,p_ends_at),v_old.ends_at,v_old.purpose,v_old.notes,'APPROVED',v_old.requires_key,v_old.id) returning id into v_right;
 end if;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 select 'BOOKING_PRIORITY_OVERRIDE',p.email,'booking',v_old.id,'booking-priority-override',
  jsonb_build_object('priority_booking_id',v_priority.id,'left_booking_id',v_left,'right_booking_id',v_right,'reason',btrim(p_reason)),
  'booking:'||v_old.id||':priority:'||v_priority.id from public.profiles p where p.id=v_old.requester_id
 on conflict(idempotency_key) do nothing;
 perform public.write_audit(v_actor,'BOOKING_PRIORITY_OVERRIDE','booking',v_old.id,jsonb_build_object('priority_booking_id',v_priority.id,'left_booking_id',v_left,'right_booking_id',v_right));
 return jsonb_build_object('priority_booking_id',v_priority.id,'left_booking_id',v_left,'right_booking_id',v_right);
end $$;

create or replace function public.claim_notification_outbox(p_worker_id text,p_limit integer default 20)
returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if nullif(btrim(p_worker_id),'') is null or p_limit not between 1 and 100 then raise exception 'INVALID_CLAIM_PARAMETERS';end if;
 return query
 with candidates as (
  select id from public.notification_outbox
  where (status in('PENDING','FAILED') or (status='PROCESSING' and lease_expires_at<=now()))
   and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts
  order by scheduled_at,id for update skip locked limit p_limit
 )
 update public.notification_outbox o set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),
  lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id
 from candidates c where o.id=c.id returning o.*;
end $$;

create or replace function public.complete_notification_outbox(
 p_outbox_id uuid,p_succeeded boolean,p_error text default null,p_provider_message_id text default null
)
returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update public.notification_outbox set
  status=case when p_succeeded then 'SENT' when attempt_count>=max_attempts then 'DEAD' else 'FAILED' end,
  sent_at=case when p_succeeded then now() else null end,
  provider_message_id=case when p_succeeded then nullif(btrim(p_provider_message_id),'') else provider_message_id end,
  last_error=case when p_succeeded then null else left(coalesce(p_error,'Unknown delivery failure'),2000) end,
  next_attempt_at=case when p_succeeded then next_attempt_at else now()+make_interval(mins=>least(60,power(2,least(attempt_count,5))::integer)) end,
  locked_at=null,lease_expires_at=null,locked_by=null where id=p_outbox_id and status='PROCESSING';
 if not found then raise exception 'OUTBOX_ITEM_NOT_PROCESSING';end if;
end $$;
-- END SOURCE: 0030_baseline_workflow_functions.sql
commit;

begin;
-- BEGIN SOURCE: 0031_baseline_rls_and_compatibility.sql
-- Least-privilege access and legacy compatibility for baseline workflows.

revoke all on table public.key_requests,public.key_request_status_history,public.secure_action_tokens,
 public.notification_outbox,public.booking_segments,public.sync_runs,public.sync_change_impacts,public.announcements
from public,anon,authenticated;

grant select on public.key_requests,public.key_request_status_history,public.booking_segments,public.announcements to authenticated;
grant select on public.sync_runs,public.sync_change_impacts to authenticated;

create policy "users read own or admins read key requests" on public.key_requests for select to authenticated
using(authenticated_user_id=auth.uid() or public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_READ_ALL'));

create policy "users read related key request history" on public.key_request_status_history for select to authenticated
using(exists(select 1 from public.key_requests r where r.id=key_request_id and
 (r.authenticated_user_id=auth.uid() or public.has_permission('KEY_MANAGE') or public.has_permission('BOOKING_READ_ALL'))));

create policy "users read related booking segments" on public.booking_segments for select to authenticated
using(exists(select 1 from public.bookings b where b.id=booking_id and
 (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid() or public.has_permission('BOOKING_READ_ALL'))));

create policy "admins read sync runs" on public.sync_runs for select to authenticated
using(public.has_permission('SCHEDULE_MANAGE') or public.has_permission('ROOM_MANAGE') or public.has_permission('AUDIT_READ'));

create policy "admins read sync impacts" on public.sync_change_impacts for select to authenticated
using(public.has_permission('SCHEDULE_MANAGE') or public.has_permission('ROOM_MANAGE') or public.has_permission('AUDIT_READ'));

create policy "authenticated read active announcements" on public.announcements for select to authenticated
using((active and visible_from<=now() and (visible_until is null or visible_until>now())) or public.has_permission('SETTINGS_MANAGE'));

revoke all on function public.create_key_request(uuid,text,text,text,text,timestamptz,timestamptz,text,text,text,text),
 public.decide_key_request(uuid,text,text),public.register_key_request_action_token(uuid,text,text,timestamptz),
 public.issue_key_request_action_bundle(uuid,timestamptz),
 public.consume_key_request_action(text,text),
 public.create_priority_booking_override(uuid,timestamptz,timestamptz,text,text),
 public.update_room_key_approval_mode(uuid,text),public.create_meeting_booking(uuid,timestamptz,timestamptz,text,text),
 public.upsert_announcement(uuid,text,text,text,boolean,timestamptz,timestamptz),
 public.claim_notification_outbox(text,integer),public.complete_notification_outbox(uuid,boolean,text,text)
from public,anon,authenticated;

revoke all on function public.append_key_request_history(),public.ensure_booking_segment(),public.sync_booking_segments(),
 public.prevent_legacy_key_overlap_with_baseline(),public.enforce_meeting_booking_role()
from public,anon,authenticated;

grant execute on function public.create_key_request(uuid,text,text,text,text,timestamptz,timestamptz,text,text,text,text) to anon,authenticated;
grant execute on function public.consume_key_request_action(text,text) to anon,authenticated;
grant execute on function public.decide_key_request(uuid,text,text),
 public.register_key_request_action_token(uuid,text,text,timestamptz),
 public.create_priority_booking_override(uuid,timestamptz,timestamptz,text,text),public.update_room_key_approval_mode(uuid,text),
 public.create_meeting_booking(uuid,timestamptz,timestamptz,text,text),
 public.upsert_announcement(uuid,text,text,text,boolean,timestamptz,timestamptz) to authenticated;
grant execute on function public.register_key_request_action_token(uuid,text,text,timestamptz),
 public.issue_key_request_action_bundle(uuid,timestamptz),
 public.claim_notification_outbox(text,integer),public.complete_notification_outbox(uuid,boolean,text,text) to service_role;

create view public.key_request_history_compat_v with (security_invoker=true) as
select r.id,'BASELINE_REQUEST'::text source_kind,r.room_id,r.authenticated_user_id requester_user_id,
 r.requester_name,r.requester_email,r.starts_at,r.ends_at,r.status,r.returned_at,r.created_at
from public.key_requests r
union all
select l.id,'LEGACY_KEY_LOAN'::text,l.room_id,l.borrower_id,p.full_name,p.email,
 coalesce(l.checked_out_at,l.requested_at),l.expected_return_at,l.status::text,l.returned_at,l.requested_at
from public.key_loans l join public.profiles p on p.id=l.borrower_id;

revoke all on public.key_request_history_compat_v from public,anon;
grant select on public.key_request_history_compat_v to authenticated;

comment on view public.key_request_history_compat_v is
'Authenticated compatibility surface only. Public identity disclosure remains disabled pending privacy confirmation.';
-- END SOURCE: 0031_baseline_rls_and_compatibility.sql
commit;

begin;
-- BEGIN SOURCE: 0032_key_request_entry_contract.sql
-- Align the public key-request entry with the approved mobile workflow.
-- This migration is additive and must be runtime-tested before any cloud push.

drop function if exists public.get_public_room_catalog();
create function public.get_public_room_catalog()
returns table(
  id uuid, code text, layout_key text, name text, room_type_name text,
  building text, floor text, capacity integer, active boolean,
  academic_schedule_confirmed boolean, usage_scope text,
  requires_sso_for_key_request boolean
)
language sql stable security definer set search_path = '' as $$
  select r.id,r.code,r.layout_key,r.name,rt.name,r.building,r.floor,r.capacity,
    r.active,r.academic_schedule_confirmed,rt.usage_scope,rt.requires_sso_for_key_request
  from public.rooms r
  join public.room_types rt on rt.id = r.room_type_id
  left join public.room_usage_policies p on p.room_id = r.id
  where case
    when auth.uid() is null then coalesce(p.guest_view_details,true)
    when public.has_role('STUDENT') then coalesce(p.student_view_details,true)
    else true
  end
  order by r.code
$$;

revoke all on function public.get_public_room_catalog() from public;
grant execute on function public.get_public_room_catalog() to anon,authenticated;

create or replace function public.enforce_key_request_entry_rules()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.requester_email := lower(btrim(new.requester_email));
  if new.requester_email !~ '^[^@[:space:]]+@northbkk[.]ac[.]th$' then
    raise exception 'UNIVERSITY_EMAIL_REQUIRED' using errcode = '22023';
  end if;
  if extract(dow from new.starts_at at time zone 'Asia/Bangkok') = 6
     or extract(dow from new.ends_at at time zone 'Asia/Bangkok') = 6 then
    raise exception 'SATURDAY_NOT_AVAILABLE' using errcode = '22023';
  end if;
  if (new.starts_at at time zone 'Asia/Bangkok')::time < time '08:00'
     or (new.ends_at at time zone 'Asia/Bangkok')::time > time '18:00' then
    raise exception 'OUTSIDE_SERVICE_HOURS' using errcode = '22023';
  end if;
  return new;
end
$$;

drop trigger if exists enforce_key_request_entry_rules on public.key_requests;
create trigger enforce_key_request_entry_rules
before insert or update of requester_email,starts_at,ends_at on public.key_requests
for each row execute function public.enforce_key_request_entry_rules();
-- END SOURCE: 0032_key_request_entry_contract.sql
commit;

begin;
-- BEGIN SOURCE: 0033_key_request_room_catalog_seed.sql
-- Idempotent display data for the mobile key-request journey.
-- Existing room UUIDs and operational history are preserved.
insert into public.equipment(code,name,description) values
 ('MICROPHONE','ไมโครโฟน','อุปกรณ์ขยายเสียงประจำห้อง'),('SPEAKER','ลำโพง','ระบบเสียงประจำห้อง'),
 ('WHITEBOARD','กระดานไวท์บอร์ด','กระดานสำหรับการเรียนการสอน'),('COMPUTER','คอมพิวเตอร์','เครื่องคอมพิวเตอร์สำหรับผู้ใช้งาน')
on conflict(code) do update set name=excluded.name,description=excluded.description;

with catalog(code,name,type_code,capacity,description,location_description) as (values
 ('S2407','ห้องปฏิบัติการ S2407','COMPUTER',30,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2408','ห้องปฏิบัติการ S2408','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2409','ห้องปฏิบัติการ S2409','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2410','ห้องปฏิบัติการ S2410','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2411','ห้องปฏิบัติการ S2411','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2412','ห้องปฏิบัติการ S2412','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('STUDIO','Studio','STUDIO',20,'ห้องผลิตสื่อและบันทึกภาพ','ชั้นลอย ใกล้บันได'),
 ('ESPORT','E-Sport','GAMING',30,'ห้องปฏิบัติการกีฬาอิเล็กทรอนิกส์','ชั้นลอย ใกล้บันได'),
 ('ELEARNING','ห้องผลิตสื่อ e-learning','ELEARNING',20,'ห้องผลิตสื่อการเรียนรู้ออนไลน์','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4')
)
insert into public.rooms(code,layout_key,name,room_type_id,building,floor,location_description,capacity,description,booking_enabled,active)
select c.code,c.code,c.name,t.id,'อาคารคณะเทคโนโลยีสารสนเทศ',case when c.code in('STUDIO','ESPORT') then 'ชั้นลอย' else '4' end,c.location_description,c.capacity,c.description,true,true
from catalog c join public.room_types t on t.code=c.type_code
on conflict(code) do update set name=excluded.name,room_type_id=excluded.room_type_id,building=excluded.building,floor=excluded.floor,location_description=excluded.location_description,capacity=excluded.capacity,description=excluded.description;

insert into public.room_equipment(room_id,equipment_id,quantity)
select r.id,e.id,case when e.code='COMPUTER' then greatest(r.capacity,1) else 1 end
from public.rooms r cross join public.equipment e
where r.code in('S2407','S2408','S2409','S2410','S2411','S2412','STUDIO','ESPORT','ELEARNING')
  and e.code in('MICROPHONE','SPEAKER','WHITEBOARD','COMPUTER')
on conflict(room_id,equipment_id) do update set quantity=excluded.quantity;

update public.rooms set key_approval_mode='AUTO' where code in('S2407','S2408','S2409','S2410','S2411','S2412');
update public.rooms set key_approval_mode='ADMIN' where code in('STUDIO','ESPORT','ELEARNING');
-- END SOURCE: 0033_key_request_room_catalog_seed.sql
commit;

begin;
-- BEGIN SOURCE: 0034_key_request_public_experience.sql
-- Product-owner approved public key-request experience.
-- Public output is limited to requester name, time and status; identifiers and email remain private.
alter table public.key_requests
 add column requester_type text check(requester_type in('STUDENT','TEACHER')),
 add column requester_identifier text check(requester_identifier is null or length(btrim(requester_identifier)) between 1 and 50);

create table public.key_request_reference_options(
 id uuid primary key default gen_random_uuid(),course_code text not null,course_name text not null,
 lecturer_name text not null,lecturer_email text not null check(lower(lecturer_email)=lecturer_email and lecturer_email~'^[^@[:space:]]+@northbkk[.]ac[.]th$'),
 active boolean not null default true,unique(course_code,lecturer_email)
);
alter table public.key_request_reference_options enable row level security;

insert into public.key_request_reference_options(course_code,course_name,lecturer_name,lecturer_email) values
 ('ITD336','การพัฒนาเว็บแอปพลิเคชัน','อ. พสวัตน์','pasawat@northbkk.ac.th'),
 ('ITD463','โครงงานเทคโนโลยีสารสนเทศ','ผศ. กิตติชัย','kittichai@northbkk.ac.th')
on conflict(course_code,lecturer_email) do update set course_name=excluded.course_name,lecturer_name=excluded.lecturer_name,active=true;

create or replace function public.get_public_key_request_history(p_room_id uuid,p_limit integer default 10)
returns table(id uuid,requester_name text,starts_at timestamptz,ends_at timestamptz,status text)
language sql security definer set search_path='' stable as $$
 select r.id,r.requester_name,r.starts_at,r.ends_at,r.status from public.key_requests r
 where r.room_id=p_room_id and r.status in('APPROVED','IN_USE','RETURNED')
 order by r.starts_at desc limit least(greatest(coalesce(p_limit,10),1),10)
$$;

create or replace function public.get_public_key_request_options()
returns table(id uuid,course_code text,course_name text,lecturer_name text)
language sql security definer set search_path='' stable as $$
 select o.id,o.course_code,o.course_name,o.lecturer_name from public.key_request_reference_options o where o.active order by o.course_code
$$;

create or replace function public.create_key_request_v2(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_requester_type text,p_requester_identifier text,
 p_purpose_type text,p_purpose text,p_starts_at timestamptz,p_ends_at timestamptz,p_reference_option_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_id uuid;v_option public.key_request_reference_options;begin
 if p_requester_type not in('STUDENT','TEACHER') or nullif(btrim(p_requester_identifier),'') is null or length(btrim(p_requester_identifier))>50 then raise exception 'REQUESTER_IDENTITY_REQUIRED';end if;
 if p_purpose_type='TEACHING' then
  select * into v_option from public.key_request_reference_options where id=p_reference_option_id and active;
  if not found then raise exception 'REFERENCE_OPTION_REQUIRED';end if;
 end if;
 v_result:=public.create_key_request(p_room_id,p_requester_name,p_requester_email,p_purpose_type,p_purpose,p_starts_at,p_ends_at,
  v_option.course_code,v_option.course_name,v_option.lecturer_name,v_option.lecturer_email);
 v_id:=(v_result->>'id')::uuid;
 update public.key_requests set requester_type=p_requester_type,requester_identifier=btrim(p_requester_identifier) where id=v_id;
 return v_result;
end $$;

revoke all on function public.get_public_key_request_history(uuid,integer) from public;
revoke all on function public.get_public_key_request_options() from public;
revoke all on function public.create_key_request_v2(uuid,text,text,text,text,text,text,timestamptz,timestamptz,uuid) from public;
grant execute on function public.get_public_key_request_history(uuid,integer) to anon,authenticated;
grant execute on function public.get_public_key_request_options() to anon,authenticated;
grant execute on function public.create_key_request_v2(uuid,text,text,text,text,text,text,timestamptz,timestamptz,uuid) to anon,authenticated;

insert into public.booking_rules(rule_key,rule_value,description,active) values
 ('PUBLIC_KEY_HISTORY_IDENTITY_ENABLED','true'::jsonb,'Product owner approved full requester names for the latest 10 public key requests',true)
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description,active=true,updated_at=now();
-- END SOURCE: 0034_key_request_public_experience.sql
commit;

begin;
-- BEGIN SOURCE: 0035_key_request_catalog_schedule.sql
-- Include the baseline key-request workflow in the public catalog without rewriting applied migration 0034.
create or replace function public.get_public_key_request_history(p_room_id uuid,p_limit integer default 10)
returns table(id uuid,requester_name text,starts_at timestamptz,ends_at timestamptz,status text)
language sql security definer set search_path='' stable as $$
 select r.id,r.requester_name,r.starts_at,r.ends_at,r.status from public.key_requests r
 where r.room_id=p_room_id
  and r.status in('PENDING_APPROVAL','APPROVED','IN_USE','RETURNED')
  and (r.starts_at at time zone 'Asia/Bangkok')::date<=(now() at time zone 'Asia/Bangkok')::date
 order by r.starts_at desc limit least(greatest(coalesce(p_limit,10),1),10)
$$;

create or replace function public.get_public_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text,is_mine boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_can_view boolean;
begin
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE'; end if;
 if not exists(select 1 from public.rooms r where r.id=p_room_id and r.active) then raise exception 'ROOM_NOT_FOUND'; end if;
 select case when auth.uid() is null then coalesce(p.guest_view_schedule,true) when public.has_role('STUDENT') then coalesce(p.student_view_schedule,true) else true end into v_can_view from public.rooms r left join public.room_usage_policies p on p.room_id=r.id where r.id=p_room_id;
 if not coalesce(v_can_view,false) then raise exception 'SCHEDULE_POLICY_DENIED' using errcode='42501';end if;
 return query with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ), events as (
  select 'class:'||s.id||':'||s.occurrence_date event_id,'CLASS'::text event_kind,coalesce(s.course_code||' · '||s.subject_name,'ตารางเรียน') event_title,(s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok' event_start,(s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok' event_end,null::uuid event_source_id,'CLASS_SCHEDULE'::text event_source_type,'ACTIVE'::text event_status,false event_is_mine from occurrences s
  union all select 'booking:'||md5(b.id::text),'BOOKING','มีการจองห้อง',b.starts_at,b.ends_at,null::uuid,'BOOKING',b.status::text,(auth.uid() is not null and (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid())) from public.bookings b where b.room_id=p_room_id and b.status in ('PENDING','APPROVED','IN_USE') and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'key-request:'||md5(r.id::text),'BOOKING','มีคำขอเบิกกุญแจ',r.starts_at,r.ends_at,null::uuid,'KEY_REQUEST',r.status,false from public.key_requests r where r.room_id=p_room_id and r.status in('PENDING_APPROVAL','APPROVED','IN_USE') and r.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and r.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE',false from public.room_blocks rb where rb.room_id=p_room_id and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 ) select e.event_id,e.event_kind,e.event_title,e.event_start,e.event_end,e.event_source_id,e.event_source_type,e.event_status,e.event_is_mine from events e order by e.event_start;
end $$;

revoke all on function public.get_public_key_request_history(uuid,integer) from public;
revoke all on function public.get_public_room_schedule_events(uuid,date,date) from public;
grant execute on function public.get_public_key_request_history(uuid,integer) to anon,authenticated;
grant execute on function public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;
-- END SOURCE: 0035_key_request_catalog_schedule.sql
commit;

begin;
-- BEGIN SOURCE: 0036_teacher_teaching_key_requests.sql
-- Teachers identify themselves as the instructor, so a separate course reference is optional.
-- Students opening a teaching room must still select an approved course/instructor option.
alter table public.key_requests drop constraint key_requests_teaching_fields;
alter table public.key_requests add constraint key_requests_teaching_fields check (
 purpose_type<>'TEACHING' or requester_type='TEACHER' or (
  nullif(btrim(course_code),'') is not null and nullif(btrim(course_name),'') is not null and
  nullif(btrim(lecturer_name),'') is not null and nullif(btrim(lecturer_email),'') is not null and
  lower(lecturer_email) ~ '^[^@[:space:]]+@northbkk[.]ac[.]th$'
 )
);

create or replace function public.create_key_request_v2(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_requester_type text,p_requester_identifier text,
 p_purpose_type text,p_purpose text,p_starts_at timestamptz,p_ends_at timestamptz,p_reference_option_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_id uuid;v_option public.key_request_reference_options;begin
 if p_requester_type not in('STUDENT','TEACHER') or nullif(btrim(p_requester_identifier),'') is null or length(btrim(p_requester_identifier))>50 then raise exception 'REQUESTER_IDENTITY_REQUIRED';end if;
 if p_requester_type='STUDENT' and p_purpose_type='TEACHING' then
  select * into v_option from public.key_request_reference_options where id=p_reference_option_id and active;
  if not found then raise exception 'REFERENCE_OPTION_REQUIRED';end if;
 end if;
 if p_requester_type='TEACHER' and p_purpose_type='TEACHING' then
  v_result:=public.create_key_request(p_room_id,p_requester_name,p_requester_email,'OTHER',p_purpose,p_starts_at,p_ends_at,null,null,null,null);
 else
  v_result:=public.create_key_request(p_room_id,p_requester_name,p_requester_email,p_purpose_type,p_purpose,p_starts_at,p_ends_at,
   v_option.course_code,v_option.course_name,v_option.lecturer_name,v_option.lecturer_email);
 end if;
 v_id:=(v_result->>'id')::uuid;
 update public.key_requests set requester_type=p_requester_type,requester_identifier=btrim(p_requester_identifier),
  purpose_type=case when p_requester_type='TEACHER' and p_purpose_type='TEACHING' then 'TEACHING' else purpose_type end
 where id=v_id;
 return v_result;
end $$;

revoke all on function public.create_key_request(uuid,text,text,text,text,timestamptz,timestamptz,text,text,text,text) from public,anon,authenticated;
revoke all on function public.create_key_request_v2(uuid,text,text,text,text,text,text,timestamptz,timestamptz,uuid) from public;
grant execute on function public.create_key_request_v2(uuid,text,text,text,text,text,text,timestamptz,timestamptz,uuid) to anon,authenticated;
-- END SOURCE: 0036_teacher_teaching_key_requests.sql
commit;

begin;
-- BEGIN SOURCE: 0037_key_request_self_service.sql
create or replace function public.get_my_key_requests()
returns table(id uuid,request_code text,room_code text,room_name text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text)
language sql security definer set search_path='' stable as $$
 select k.id,k.request_code,r.code,r.name,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,k.status
 from public.key_requests k join public.rooms r on r.id=k.room_id
 where auth.uid() is not null and k.authenticated_user_id=auth.uid()
 order by k.created_at desc
$$;

create or replace function public.cancel_my_key_request(p_key_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_request public.key_requests;begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 select * into v_request from public.key_requests where id=p_key_request_id and authenticated_user_id=v_actor for update;
 if not found then raise exception 'KEY_REQUEST_NOT_FOUND' using errcode='42501';end if;
 if v_request.status not in('PENDING_APPROVAL','APPROVED') then raise exception 'KEY_REQUEST_CANNOT_CANCEL';end if;
 update public.key_requests set status='CANCELLED',cancelled_at=now() where id=v_request.id;
 perform public.write_audit(v_actor,'KEY_REQUEST_CANCELLED','key_request',v_request.id,jsonb_build_object('source','SELF_SERVICE'));
 return jsonb_build_object('id',v_request.id,'status','CANCELLED');
end $$;

revoke all on function public.get_my_key_requests() from public;
revoke all on function public.cancel_my_key_request(uuid) from public;
grant execute on function public.get_my_key_requests() to authenticated;
grant execute on function public.cancel_my_key_request(uuid) to authenticated;
-- END SOURCE: 0037_key_request_self_service.sql
commit;

begin;
-- BEGIN SOURCE: 0038_key_request_history_by_verified_email.sql
drop function if exists public.get_my_key_requests();

create function public.get_my_key_requests()
returns table(id uuid,request_code text,room_code text,room_name text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text,can_cancel boolean)
language plpgsql security definer set search_path='' stable as $$
declare v_email text;
begin
 select lower(u.email) into v_email
 from auth.users u
 where u.id=auth.uid() and u.email_confirmed_at is not null;
 if v_email is null then return;end if;
 return query
 select k.id,k.request_code,r.code,r.name,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,k.status,
  k.authenticated_user_id=auth.uid() as can_cancel
 from public.key_requests k join public.rooms r on r.id=k.room_id
 where k.authenticated_user_id=auth.uid()
  or (k.authenticated_user_id is null and lower(k.requester_email)=lower(v_email))
 order by k.created_at desc;
end $$;

revoke all on function public.get_my_key_requests() from public;
grant execute on function public.get_my_key_requests() to authenticated;
-- END SOURCE: 0038_key_request_history_by_verified_email.sql
commit;

begin;
-- BEGIN SOURCE: 0039_cancellable_key_request_history.sql
drop function if exists public.get_my_key_requests();

create function public.get_my_key_requests()
returns table(id uuid,request_code text,room_code text,room_name text,room_type_name text,floor text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text,can_cancel boolean)
language plpgsql security definer set search_path='' stable as $$
declare v_email text;
begin
 select lower(u.email) into v_email from auth.users u
 where u.id=auth.uid() and u.email_confirmed_at is not null;
 if v_email is null then return;end if;
 return query
 select k.id,k.request_code,r.code,r.name,rt.name,r.floor,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,k.status,
  (k.status in('PENDING_APPROVAL','APPROVED') and k.ends_at>now()) as can_cancel
 from public.key_requests k
 join public.rooms r on r.id=k.room_id
 join public.room_types rt on rt.id=r.room_type_id
 where k.authenticated_user_id=auth.uid()
  or (k.authenticated_user_id is null and lower(k.requester_email)=lower(v_email))
 order by k.created_at desc;
end $$;

create or replace function public.cancel_my_key_request(p_key_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_email text;v_request public.key_requests;begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 select lower(u.email) into v_email from auth.users u where u.id=v_actor and u.email_confirmed_at is not null;
 select * into v_request from public.key_requests where id=p_key_request_id for update;
 if not found or not(v_request.authenticated_user_id=v_actor or (v_request.authenticated_user_id is null and v_email is not null and lower(v_request.requester_email)=lower(v_email))) then raise exception 'KEY_REQUEST_NOT_FOUND' using errcode='42501';end if;
 if v_request.status not in('PENDING_APPROVAL','APPROVED') then raise exception 'KEY_REQUEST_CANNOT_CANCEL';end if;
 if v_request.ends_at<=now() then raise exception 'KEY_REQUEST_CANCELLATION_CLOSED';end if;
 update public.key_requests set status='CANCELLED',cancelled_at=now() where id=v_request.id;
 perform public.write_audit(v_actor,'KEY_REQUEST_CANCELLED','key_request',v_request.id,jsonb_build_object('source','SELF_SERVICE'));
 return jsonb_build_object('id',v_request.id,'status','CANCELLED');
end $$;

revoke all on function public.get_my_key_requests() from public;
revoke all on function public.cancel_my_key_request(uuid) from public;
grant execute on function public.get_my_key_requests() to authenticated;
grant execute on function public.cancel_my_key_request(uuid) to authenticated;
-- END SOURCE: 0039_cancellable_key_request_history.sql
commit;

begin;
-- BEGIN SOURCE: 0040_key_request_email_notifications.sql
create or replace function public.enqueue_key_request_timed_emails() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in('APPROVED','IN_USE') then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,scheduled_at,next_attempt_at,idempotency_key) values
   ('KEY_REQUEST_ENDING_SOON',new.requester_email,'key_request',new.id,'key-request-ending-soon',jsonb_build_object('request_code',new.request_code),greatest(now(),new.ends_at-interval '30 minutes'),greatest(now(),new.ends_at-interval '30 minutes'),'key-request:'||new.id||':ending-soon'),
   ('KEY_REQUEST_ENDED',new.requester_email,'key_request',new.id,'key-request-ended',jsonb_build_object('request_code',new.request_code),new.ends_at,new.ends_at,'key-request:'||new.id||':ended')
  on conflict(idempotency_key) do update set scheduled_at=excluded.scheduled_at,next_attempt_at=excluded.next_attempt_at where notification_outbox.status in('PENDING','FAILED');
 else update public.notification_outbox set status='CANCELLED' where entity_type='key_request' and entity_id=new.id and template_key in('key-request-ending-soon','key-request-ended') and status in('PENDING','FAILED');end if;
 return new;
end $$;
drop trigger if exists enqueue_key_request_timed_emails on public.key_requests;
create trigger enqueue_key_request_timed_emails after insert or update of status,starts_at,ends_at on public.key_requests for each row execute function public.enqueue_key_request_timed_emails();

insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,scheduled_at,next_attempt_at,idempotency_key)
select 'KEY_REQUEST_ENDING_SOON',k.requester_email,'key_request',k.id,'key-request-ending-soon',jsonb_build_object('request_code',k.request_code),greatest(now(),k.ends_at-interval '30 minutes'),greatest(now(),k.ends_at-interval '30 minutes'),'key-request:'||k.id||':ending-soon' from public.key_requests k where k.status in('APPROVED','IN_USE') and k.ends_at>now() on conflict(idempotency_key) do nothing;
insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,scheduled_at,next_attempt_at,idempotency_key)
select 'KEY_REQUEST_ENDED',k.requester_email,'key_request',k.id,'key-request-ended',jsonb_build_object('request_code',k.request_code),k.ends_at,k.ends_at,'key-request:'||k.id||':ended' from public.key_requests k where k.status in('APPROVED','IN_USE') and k.ends_at>now() on conflict(idempotency_key) do nothing;

create or replace function public.claim_notification_outbox_test(p_worker_id text,p_recipient text,p_limit integer default 20) returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if nullif(btrim(p_worker_id),'') is null or nullif(btrim(p_recipient),'') is null or p_limit not between 1 and 100 then raise exception 'INVALID_CLAIM_PARAMETERS';end if;
 return query with candidates as(select id from public.notification_outbox where lower(recipient_email)=lower(btrim(p_recipient)) and(status in('PENDING','FAILED') or(status='PROCESSING' and lease_expires_at<=now())) and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts order by scheduled_at,id for update skip locked limit p_limit)
 update public.notification_outbox o set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id from candidates c where o.id=c.id returning o.*;
end $$;
revoke all on function public.enqueue_key_request_timed_emails(),public.claim_notification_outbox_test(text,text,integer) from public,anon,authenticated;
grant execute on function public.claim_notification_outbox_test(text,text,integer) to service_role;
-- END SOURCE: 0040_key_request_email_notifications.sql
commit;

begin;
-- BEGIN SOURCE: 0041_email_worker_key_request_context.sql
create or replace function public.get_key_request_email_context(p_key_request_id uuid)
returns table(request_code text,status text,starts_at timestamptz,ends_at timestamptz,purpose text,decision_reason text,room_name text)
language plpgsql security definer set search_path='' stable as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query
 select k.request_code,k.status,k.starts_at,k.ends_at,k.purpose,k.decision_reason,r.name
 from public.key_requests k join public.rooms r on r.id=k.room_id
 where k.id=p_key_request_id;
end $$;

revoke all on function public.get_key_request_email_context(uuid) from public,anon,authenticated;
grant execute on function public.get_key_request_email_context(uuid) to service_role;
-- END SOURCE: 0041_email_worker_key_request_context.sql
commit;

begin;
-- BEGIN SOURCE: 0042_fix_action_bundle_encode.sql
create or replace function public.issue_key_request_action_bundle(p_key_request_id uuid,p_expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_track text;v_cancel text;v_return text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_expires_at<=now() then raise exception 'TOKEN_ALREADY_EXPIRED';end if;
 if not exists(select 1 from public.key_requests where id=p_key_request_id) then raise exception 'KEY_REQUEST_NOT_FOUND';end if;
 v_track:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 v_cancel:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 v_return:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 insert into public.secure_action_tokens(key_request_id,action,token_digest,expires_at) values
  (p_key_request_id,'TRACK',extensions.digest(pg_catalog.convert_to(v_track,'UTF8'),'sha256'),p_expires_at),
  (p_key_request_id,'CANCEL',extensions.digest(pg_catalog.convert_to(v_cancel,'UTF8'),'sha256'),p_expires_at),
  (p_key_request_id,'RETURN',extensions.digest(pg_catalog.convert_to(v_return,'UTF8'),'sha256'),p_expires_at);
 return jsonb_build_object('track_token',v_track,'cancel_token',v_cancel,'return_token',v_return,'expires_at',p_expires_at);
end $$;

revoke all on function public.issue_key_request_action_bundle(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.issue_key_request_action_bundle(uuid,timestamptz) to service_role;
-- END SOURCE: 0042_fix_action_bundle_encode.sql
commit;

begin;
-- BEGIN SOURCE: 0043_key_request_terminal_email_notifications.sql
create or replace function public.enqueue_key_request_terminal_email()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if old.status is distinct from new.status and new.status='CANCELLED' then
    insert into public.notification_outbox(
      notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key
    ) values(
      'KEY_REQUEST_CANCELLED',new.requester_email,'key_request',new.id,'key-request-cancelled',
      jsonb_build_object('request_code',new.request_code,'status',new.status),
      'key-request:'||new.id||':cancelled'
    ) on conflict(idempotency_key) do nothing;
  elsif old.status is distinct from new.status and new.status='RETURNED' then
    insert into public.notification_outbox(
      notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key
    ) values(
      'KEY_REQUEST_RETURNED',new.requester_email,'key_request',new.id,'key-request-returned',
      jsonb_build_object('request_code',new.request_code,'status',new.status),
      'key-request:'||new.id||':returned'
    ) on conflict(idempotency_key) do nothing;
  end if;
  return new;
end
$$;

drop trigger if exists enqueue_key_request_terminal_email on public.key_requests;
create trigger enqueue_key_request_terminal_email
after update of status on public.key_requests
for each row execute function public.enqueue_key_request_terminal_email();

revoke all on function public.enqueue_key_request_terminal_email() from public,anon,authenticated;
-- END SOURCE: 0043_key_request_terminal_email_notifications.sql
commit;

begin;
-- BEGIN SOURCE: 0044_test_email_entity_dispatch.sql
create or replace function public.claim_notification_outbox_entity_test(
  p_worker_id text,
  p_recipient text,
  p_entity_id uuid,
  p_limit integer default 10
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path=''
as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if nullif(btrim(p_worker_id),'') is null or nullif(btrim(p_recipient),'') is null or p_limit not between 1 and 20 then
    raise exception 'INVALID_CLAIM_PARAMETERS';
  end if;
  return query
  with candidates as (
    select id
    from public.notification_outbox
    where lower(recipient_email)=lower(btrim(p_recipient))
      and entity_type='key_request'
      and entity_id=p_entity_id
      and (status in('PENDING','FAILED') or (status='PROCESSING' and lease_expires_at<=now()))
      and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts
    order by scheduled_at,id
    for update skip locked
    limit p_limit
  )
  update public.notification_outbox o
  set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),
      lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id
  from candidates c where o.id=c.id
  returning o.*;
end
$$;

revoke all on function public.claim_notification_outbox_entity_test(text,text,uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_notification_outbox_entity_test(text,text,uuid,integer) to service_role;
-- END SOURCE: 0044_test_email_entity_dispatch.sql
commit;

begin;
-- BEGIN SOURCE: 0045_secure_email_entity_dispatch.sql
create table public.email_dispatch_tokens(
  key_request_id uuid primary key references public.key_requests(id) on delete cascade,
  token_digest bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.email_dispatch_tokens enable row level security;
revoke all on public.email_dispatch_tokens from public,anon,authenticated;

create or replace function public.create_key_request(
 p_room_id uuid,p_requester_name text,p_requester_email text,p_purpose_type text,p_purpose text,
 p_starts_at timestamptz,p_ends_at timestamptz,p_course_code text default null,p_course_name text default null,
 p_lecturer_name text default null,p_lecturer_email text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_type public.room_types;v_request public.key_requests;v_room_mode text;v_profile public.profiles;
 v_today date:=(now() at time zone 'Asia/Bangkok')::date;v_dispatch_token text;
begin
 if p_ends_at<=p_starts_at then raise exception 'INVALID_TIME_RANGE';end if;
 if (p_starts_at at time zone 'Asia/Bangkok')::date<>v_today or (p_ends_at at time zone 'Asia/Bangkok')::date<>v_today then raise exception 'KEY_REQUEST_CURRENT_DAY_ONLY';end if;
 if (p_starts_at at time zone 'Asia/Bangkok')::time<time '08:00' or (p_ends_at at time zone 'Asia/Bangkok')::time>time '18:00' then raise exception 'OUTSIDE_SERVICE_HOURS';end if;
 select rt.* into v_type from public.rooms r join public.room_types rt on rt.id=r.room_type_id where r.id=p_room_id and r.active and r.booking_enabled for share of r;
 if not found or v_type.usage_scope<>'LABORATORY' then raise exception 'ROOM_NOT_AVAILABLE';end if;
 if v_type.requires_sso_for_key_request and v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501';end if;
 select r.key_approval_mode into v_room_mode from public.rooms r where r.id=p_room_id;
 if v_actor is not null then
  select * into v_profile from public.profiles p where p.id=v_actor and p.account_status='ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
  if v_type.requires_sso_for_key_request then p_requester_name:=v_profile.full_name;p_requester_email:=v_profile.email;end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,336));
 if exists(select 1 from public.key_loans l left join public.bookings b on b.id=l.booking_id where l.room_id=p_room_id and l.status in('REQUESTED','APPROVED','CHECKED_OUT','LATE') and tstzrange(coalesce(b.starts_at,l.checked_out_at,l.requested_at),coalesce(b.ends_at,l.expected_return_at,l.requested_at+interval '1 minute'),'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) then raise exception 'LEGACY_KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';end if;
 begin
  insert into public.key_requests(room_id,authenticated_user_id,requester_name,requester_email,purpose_type,purpose,course_code,course_name,lecturer_name,lecturer_email,starts_at,ends_at,status,approval_mode)
  values(p_room_id,v_actor,btrim(p_requester_name),lower(btrim(p_requester_email)),upper(btrim(p_purpose_type)),btrim(p_purpose),nullif(btrim(p_course_code),''),nullif(btrim(p_course_name),''),nullif(btrim(p_lecturer_name),''),lower(nullif(btrim(p_lecturer_email),'')),p_starts_at,p_ends_at,case when coalesce(nullif(v_room_mode,'INHERIT'),v_type.default_key_approval_mode)='AUTO' then 'APPROVED' else 'PENDING_APPROVAL' end,coalesce(nullif(v_room_mode,'INHERIT'),v_type.default_key_approval_mode))
  returning * into v_request;
 exception when exclusion_violation then raise exception 'KEY_REQUEST_TIME_CONFLICT' using errcode='23P01';end;
 insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
 values('KEY_REQUEST_SUBMITTED',v_request.requester_email,'key_request',v_request.id,'key-request-submitted',jsonb_build_object('request_code',v_request.request_code,'status',v_request.status,'action_bundle_required',true),'key-request:'||v_request.id||':submitted') on conflict(idempotency_key) do nothing;
 if v_request.purpose_type='TEACHING' and v_request.lecturer_email is not null then
  insert into public.notification_outbox(notification_type,recipient_email,entity_type,entity_id,template_key,payload,idempotency_key)
  values('KEY_REQUEST_LECTURER_NOTICE',v_request.lecturer_email,'key_request',v_request.id,'key-request-lecturer-notice',jsonb_build_object('request_code',v_request.request_code),'key-request:'||v_request.id||':lecturer-submitted') on conflict(idempotency_key) do nothing;
 end if;
 v_dispatch_token:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
 insert into public.email_dispatch_tokens(key_request_id,token_digest,expires_at)
 values(v_request.id,extensions.digest(pg_catalog.convert_to(v_dispatch_token,'UTF8'),'sha256'),now()+interval '15 minutes');
 perform public.write_audit(v_actor,'KEY_REQUEST_CREATED','key_request',v_request.id,jsonb_build_object('room_id',p_room_id,'status',v_request.status,'anonymous',v_actor is null));
 return jsonb_build_object('id',v_request.id,'request_code',v_request.request_code,'status',v_request.status,'email_dispatch_token',v_dispatch_token);
end $$;

create or replace function public.claim_notification_outbox_entity_test(
 p_worker_id text,p_recipient text,p_entity_id uuid,p_dispatch_token text,p_limit integer default 10
)
returns setof public.notification_outbox language plpgsql security definer set search_path='' as $$
declare v_token public.email_dispatch_tokens;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if nullif(btrim(p_worker_id),'') is null or nullif(btrim(p_recipient),'') is null or length(coalesce(p_dispatch_token,''))<32 or p_limit not between 1 and 20 then raise exception 'INVALID_CLAIM_PARAMETERS';end if;
 select * into v_token from public.email_dispatch_tokens where key_request_id=p_entity_id and token_digest=extensions.digest(pg_catalog.convert_to(p_dispatch_token,'UTF8'),'sha256') for update;
 if not found then raise exception 'INVALID_ACTION_TOKEN' using errcode='42501';end if;
 if v_token.used_at is not null then raise exception 'ACTION_TOKEN_ALREADY_USED' using errcode='42501';end if;
 if v_token.expires_at<=now() then raise exception 'ACTION_TOKEN_EXPIRED' using errcode='42501';end if;
 update public.email_dispatch_tokens set used_at=now() where key_request_id=p_entity_id;
 return query with candidates as(
  select id from public.notification_outbox where lower(recipient_email)=lower(btrim(p_recipient)) and entity_type='key_request' and entity_id=p_entity_id
   and(status in('PENDING','FAILED') or(status='PROCESSING' and lease_expires_at<=now())) and scheduled_at<=now() and next_attempt_at<=now() and attempt_count<max_attempts
  order by scheduled_at,id for update skip locked limit p_limit
 ) update public.notification_outbox o set status='PROCESSING',attempt_count=o.attempt_count+1,locked_at=now(),lease_expires_at=now()+interval '15 minutes',locked_by=p_worker_id from candidates c where o.id=c.id returning o.*;
end $$;

revoke all on function public.claim_notification_outbox_entity_test(text,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.claim_notification_outbox_entity_test(text,text,uuid,text,integer) to service_role;
-- END SOURCE: 0045_secure_email_entity_dispatch.sql
commit;

begin;
-- BEGIN SOURCE: 0046_gmail_action_test_replay.sql
create table public.gmail_action_test_nonces(
  nonce_digest bytea primary key,
  expires_at timestamptz not null,
  consumed_at timestamptz not null default now()
);
alter table public.gmail_action_test_nonces enable row level security;
revoke all on public.gmail_action_test_nonces from public,anon,authenticated;

create or replace function public.consume_gmail_action_test_nonce(p_jti text,p_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_inserted integer;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if nullif(btrim(p_jti),'') is null or length(p_jti)>128 or p_expires_at<=now() or p_expires_at>now()+interval '15 minutes' then return false;end if;
  delete from public.gmail_action_test_nonces where expires_at<=now();
  insert into public.gmail_action_test_nonces(nonce_digest,expires_at)
  values(extensions.digest(pg_catalog.convert_to(p_jti,'UTF8'),'sha256'),p_expires_at)
  on conflict do nothing;
  get diagnostics v_inserted=row_count;
  return v_inserted=1;
end $$;

revoke all on function public.consume_gmail_action_test_nonce(text,timestamptz) from public,anon,authenticated;
grant execute on function public.consume_gmail_action_test_nonce(text,timestamptz) to service_role;
-- END SOURCE: 0046_gmail_action_test_replay.sql
commit;

begin;
-- BEGIN SOURCE: 0047_gmail_key_request_actions.sql
create table public.gmail_key_action_tokens(
  secure_action_token_id uuid primary key references public.secure_action_tokens(id) on delete cascade,
  outbox_id uuid not null unique references public.notification_outbox(id) on delete cascade,
  recipient_email_digest bytea not null,
  created_at timestamptz not null default now()
);
alter table public.gmail_key_action_tokens enable row level security;
revoke all on public.gmail_key_action_tokens from public,anon,authenticated;

create or replace function public.issue_gmail_key_action_token(
  p_outbox_id uuid,p_key_request_id uuid,p_recipient_email text,p_action text,p_expires_at timestamptz,p_raw_token text
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_action text:=upper(btrim(p_action));v_token_id uuid;v_bound_token_id uuid;v_request public.key_requests;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if v_action not in('CANCEL','RETURN') or length(coalesce(p_raw_token,''))<32 or p_expires_at<=now() then raise exception 'INVALID_GMAIL_ACTION_TOKEN';end if;
  select * into v_request from public.key_requests where id=p_key_request_id;
  if not found or extensions.digest(pg_catalog.convert_to(lower(btrim(p_recipient_email)),'UTF8'),'sha256')<>extensions.digest(pg_catalog.convert_to(lower(v_request.requester_email),'UTF8'),'sha256') then raise exception 'RECIPIENT_MISMATCH';end if;
  if not exists(select 1 from public.notification_outbox where id=p_outbox_id and entity_type='key_request' and entity_id=p_key_request_id and lower(recipient_email)=lower(btrim(p_recipient_email))) then raise exception 'OUTBOX_MISMATCH';end if;
  insert into public.secure_action_tokens(key_request_id,action,token_digest,expires_at)
  values(p_key_request_id,v_action,extensions.digest(pg_catalog.convert_to(p_raw_token,'UTF8'),'sha256'),p_expires_at)
  on conflict(token_digest) do update set token_digest=excluded.token_digest returning id into v_token_id;
  insert into public.gmail_key_action_tokens(secure_action_token_id,outbox_id,recipient_email_digest)
  values(v_token_id,p_outbox_id,extensions.digest(pg_catalog.convert_to(lower(btrim(p_recipient_email)),'UTF8'),'sha256'))
  on conflict(outbox_id) do nothing;
  select secure_action_token_id into v_bound_token_id from public.gmail_key_action_tokens where outbox_id=p_outbox_id;
  if v_bound_token_id<>v_token_id then raise exception 'OUTBOX_TOKEN_MISMATCH';end if;
  return true;
end $$;

create or replace function public.consume_gmail_key_action(
  p_raw_token text,p_action text,p_outbox_id uuid,p_key_request_id uuid,p_recipient_digest text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token public.secure_action_tokens;v_gmail public.gmail_key_action_tokens;v_request public.key_requests;v_action text:=upper(btrim(p_action));
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if v_action not in('CANCEL','RETURN') or p_recipient_digest!~'^[0-9a-fA-F]{64}$' then raise exception 'INVALID_GMAIL_ACTION_TOKEN';end if;
  select s,g into v_token,v_gmail from public.secure_action_tokens s join public.gmail_key_action_tokens g on g.secure_action_token_id=s.id
  where s.token_digest=extensions.digest(pg_catalog.convert_to(p_raw_token,'UTF8'),'sha256') and s.action=v_action and s.key_request_id=p_key_request_id and g.outbox_id=p_outbox_id
  for update of s,g;
  if not found then raise exception 'INVALID_ACTION_TOKEN' using errcode='42501';end if;
  select * into v_request from public.key_requests where id=p_key_request_id for update;
  if not found or v_gmail.recipient_email_digest<>pg_catalog.decode(lower(p_recipient_digest),'hex') or v_gmail.recipient_email_digest<>extensions.digest(pg_catalog.convert_to(lower(v_request.requester_email),'UTF8'),'sha256') then raise exception 'RECIPIENT_MISMATCH' using errcode='42501';end if;
  return public.consume_key_request_action(p_raw_token,p_action);
end $$;

revoke all on function public.issue_gmail_key_action_token(uuid,uuid,text,text,timestamptz,text) from public,anon,authenticated;
revoke all on function public.consume_gmail_key_action(text,text,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.issue_gmail_key_action_token(uuid,uuid,text,text,timestamptz,text) to service_role;
grant execute on function public.consume_gmail_key_action(text,text,uuid,uuid,text) to service_role;
-- END SOURCE: 0047_gmail_key_request_actions.sql
commit;
