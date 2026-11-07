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
