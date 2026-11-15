-- Meeting booking dates and operating times shared by the form and booking RPC.
create function public.get_meeting_booking_policy()
returns table(allowed_dates date[],opens_at time,closes_at time)
language sql stable security definer set search_path='' as $$
 with settings as (
  select (now() at time zone 'Asia/Bangkok')::date as today,
   greatest(0,least(3,coalesce((select (rule_value#>>'{}')::int from public.booking_rules where rule_key='MEETING_ADVANCE_BOOKING_DAYS' and active),3))) as day_limit,
   coalesce((select (rule_value#>>'{}')::time from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and active),time '08:30') as opening,
   coalesce((select (rule_value#>>'{}')::time from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active),time '17:30') as closing
 )
 select array(select today+d from pg_catalog.generate_series(1,7) d
  where extract(dow from today+d)<>6 or public.get_open_saturday()=(today+d)::text
  order by d limit day_limit),opening,closing from settings
 where auth.uid() is not null
$$;
revoke all on function public.get_meeting_booking_policy() from public,anon;
grant execute on function public.get_meeting_booking_policy() to authenticated;

create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
 v_policy public.booking_policy; v_student_allowed boolean; v_status public.booking_status;
 v_max_days integer; v_open time; v_close time; v_start_local timestamp; v_end_local timestamp; v_today date; v_meeting_dates date[];
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
 if exists(select 1 from public.room_types where id=v_room.room_type_id and usage_scope='MEETING') then
  select p.allowed_dates,p.opens_at,p.closes_at into v_meeting_dates,v_open,v_close from public.get_meeting_booking_policy() p;
  if not (v_start_local::date=any(v_meeting_dates)) then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 elsif v_start_local::date>v_today+v_max_days then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
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
