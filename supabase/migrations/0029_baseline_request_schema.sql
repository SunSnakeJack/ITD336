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
