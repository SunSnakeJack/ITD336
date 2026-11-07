-- Behavioral checks for a disposable local database after migrations and seed.
-- Concurrency pairs marked SESSION A/B must be executed by the test harness in separate sessions.
begin;

do $$
declare v_room uuid;v_first uuid;v_day timestamptz:=(date_trunc('day',now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok');
begin
 select id into v_room from public.rooms where code='S2407';

 begin
  insert into public.key_requests(room_id,requester_name,requester_email,purpose_type,purpose,course_code,course_name,
   lecturer_name,lecturer_email,starts_at,ends_at,status,approval_mode)
  values(v_room,'Baseline Test','test@northbkk.ac.th','TEACHING','Class','ITD336','Database','Teacher',null,
   v_day+interval '8 hours',v_day+interval '9 hours','APPROVED','AUTO');
  assert false,'teaching request accepted null lecturer email';
 exception when check_violation then null;
 end;

 insert into public.key_requests(room_id,requester_name,requester_email,purpose_type,purpose,starts_at,ends_at,status,approval_mode)
 values(v_room,'Baseline Test','test@northbkk.ac.th','OTHER','Test',
  v_day+interval '10 hours',v_day+interval '11 hours','PENDING_APPROVAL','ADMIN') returning id into v_first;
 begin
  insert into public.key_requests(room_id,requester_name,requester_email,purpose_type,purpose,starts_at,ends_at,status,approval_mode)
  values(v_room,'Second Test','second@northbkk.ac.th','OTHER','Overlap',
   v_day+interval '10 hours 30 minutes',v_day+interval '11 hours 30 minutes','APPROVED','AUTO');
  assert false,'overlapping active key request was accepted';
 exception when exclusion_violation then null;
 end;
end $$;

-- Actor matrix to be run by the local harness using seeded JWT subjects:
-- STUDENT 10000000-0000-0000-0000-000000000001: create_booking and create_meeting_booking for MEET-FACULTY must both fail.
-- TEACHER 10000000-0000-0000-0000-000000000002: create_meeting_booking may succeed inside the approved window.
-- PRIORITY-only 10000000-0000-0000-0000-000000000005: meeting creation must fail; override also requires an authorized base role.
-- ADMIN 10000000-0000-0000-0000-000000000004: approval/configuration RPCs may succeed.
-- ANON: ordinary lab request may succeed; STUDIO/ESPORT/ELEARNING must fail AUTHENTICATION_REQUIRED.
-- SESSION A/B: submit overlapping key requests for one room simultaneously; exactly one transaction commits.
-- Token: expired, reused, pre-start RETURN, and wrong-action tokens must fail without state mutation.
-- Outbox: reclaim an expired PROCESSING lease and ensure provider receives the same idempotency_key.

rollback;
