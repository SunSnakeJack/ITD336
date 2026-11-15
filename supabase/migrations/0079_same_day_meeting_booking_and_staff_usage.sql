-- Include today without consuming a future booking day.
create or replace function public.get_meeting_booking_policy()
returns table(allowed_dates date[], opens_at time, closes_at time)
language sql stable security definer set search_path = '' as $$
  with settings as (
    select (now() at time zone 'Asia/Bangkok')::date as today,
      public.get_meeting_advance_booking_days() as day_limit,
      public.get_open_saturday() as open_saturday
  )
  select case
    when extract(dow from today) <> 6 or open_saturday = today::text then array[today]
    else array[]::date[]
  end || array(
    select today + d
    from pg_catalog.generate_series(1, day_limit + (day_limit + 5) / 6) d
    where extract(dow from today + d) <> 6 or open_saturday = (today + d)::text
    order by d limit day_limit
  ), hours.opens_at, hours.closes_at
  from settings cross join public.meeting_room_operating_hours() hours
  where auth.uid() is not null
$$;

create or replace function public.enforce_meeting_booking_role()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('PENDING','APPROVED','IN_USE')
    and coalesce(auth.role(),'') <> 'service_role'
    and exists (
      select 1 from public.rooms r join public.room_types rt on rt.id = r.room_type_id
      where r.id = new.room_id and rt.usage_scope = 'MEETING'
    )
    and not (
      public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN')
      or public.has_role('DEPARTMENT_HEAD') or public.has_permission('BOOKING_OVERRIDE')
    ) then
    raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode = '42501';
  end if;
  return new;
end $$;

-- Reuse transactional displacement, history, and notifications.
create or replace function public.create_priority_booking_override(
 p_displaced_booking_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_reason text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_room_id uuid; v_is_meeting boolean; v_policy record;
 v_start_local timestamp; v_end_local timestamp;
 v_previous_override text := current_setting('app.priority_override',true);
 v_actor uuid:=auth.uid();v_old public.bookings;v_priority public.bookings;v_left uuid;v_right uuid;
begin
 if v_actor is null or not public.has_permission('BOOKING_OVERRIDE') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_ends_at<=p_starts_at or nullif(btrim(p_purpose),'') is null or nullif(btrim(p_reason),'') is null then raise exception 'INVALID_OVERRIDE_INPUT';end if;
 select b.room_id, rt.usage_scope = 'MEETING' into v_room_id,v_is_meeting
 from public.bookings b join public.rooms r on r.id=b.room_id
 join public.room_types rt on rt.id=r.room_type_id where b.id=p_displaced_booking_id;
 if not found then raise exception 'BOOKING_NOT_OVERRIDEABLE'; end if;
 if not v_is_meeting and not (public.has_role('TEACHER') or public.has_role('ADMIN')
  or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD')) then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if v_is_meeting then
  if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then
   raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  -- Use the same room lock as ordinary creation before locking the displaced row.
  perform pg_advisory_xact_lock(hashtextextended(v_room_id::text,0));
  select * into v_policy from public.get_meeting_booking_policy();
  v_start_local := p_starts_at at time zone 'Asia/Bangkok';
  v_end_local := p_ends_at at time zone 'Asia/Bangkok';
  if p_starts_at <= now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
  if not coalesce(v_start_local::date = any(v_policy.allowed_dates),false) then
   raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED';
  end if;
  if v_start_local::date <> v_end_local::date or v_start_local::time < v_policy.opens_at
   or v_end_local::time > v_policy.closes_at then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
  if not exists(select 1 from public.rooms where id=v_room_id and active and booking_enabled)
   or public.meeting_room_has_pending_overlap(v_room_id,p_starts_at,p_ends_at) then
   raise exception 'ROOM_UNAVAILABLE' using errcode='23P01';
  end if;
 end if;
 select * into v_old from public.bookings where id=p_displaced_booking_id for update;
 if not found or v_old.status not in('APPROVED','IN_USE') or v_old.is_priority or v_old.room_id is distinct from v_room_id
  or (v_is_meeting and (v_old.status <> 'APPROVED' or v_old.starts_at <= now())) then raise exception 'BOOKING_NOT_OVERRIDEABLE';end if;
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
 perform set_config('app.priority_override',coalesce(v_previous_override,''),true);
 return jsonb_build_object('priority_booking_id',v_priority.id,'left_booking_id',v_left,'right_booking_id',v_right);
end $$;

create or replace function public.create_booking(p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_requires_key boolean default false,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_booking public.bookings; v_room public.rooms;
 v_policy public.booking_policy; v_is_meeting boolean; v_student_allowed boolean; v_status public.booking_status;
 v_displaced uuid; v_override jsonb; v_can_override boolean;
 v_max_days integer; v_open time; v_close time; v_start_local timestamp; v_end_local timestamp; v_today date; v_meeting_dates date[];
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if p_ends_at<=p_starts_at or p_starts_at<=now() then raise exception 'INVALID_TIME_RANGE' using errcode='22007'; end if;
 if nullif(btrim(p_purpose),'') is null then raise exception 'PURPOSE_REQUIRED' using errcode='22023'; end if;
 select r.* into v_room from public.rooms r where r.id=p_room_id and r.active for share;
 if not found then raise exception 'ROOM_NOT_FOUND'; end if;
 select rt.booking_policy,rt.student_booking_allowed,rt.usage_scope='MEETING' into v_policy,v_student_allowed,v_is_meeting from public.room_types rt where rt.id=v_room.room_type_id;
 v_can_override := v_is_meeting and public.has_permission('BOOKING_OVERRIDE');
 if not v_is_meeting and not (public.has_role('STUDENT') or public.has_role('TEACHER') or public.has_role('ADMIN')) then
  raise exception 'BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 if not v_room.booking_enabled then raise exception 'ROOM_BOOKING_DISABLED'; end if;
 select (rule_value#>>'{}')::integer into v_max_days from public.booking_rules where rule_key='MAX_ADVANCE_BOOKING_DAYS' and active;
 select (rule_value#>>'{}')::time into v_open from public.booking_rules where rule_key='GENERAL_OPEN_TIME' and active;
 select (rule_value#>>'{}')::time into v_close from public.booking_rules where rule_key='GENERAL_CLOSE_TIME' and active;
 v_max_days:=coalesce(v_max_days,3); v_open:=coalesce(v_open,'08:30'::time); v_close:=coalesce(v_close,'17:30'::time);
 v_start_local:=p_starts_at at time zone 'Asia/Bangkok'; v_end_local:=p_ends_at at time zone 'Asia/Bangkok';
 v_today:=(now() at time zone 'Asia/Bangkok')::date;
 if v_is_meeting then
  if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then
   raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';
  end if;
  v_policy := 'AUTO_CONFIRM';
  select p.allowed_dates,p.opens_at,p.closes_at into v_meeting_dates,v_open,v_close from public.get_meeting_booking_policy() p;
  if not coalesce(v_start_local::date=any(v_meeting_dates), false) then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 elsif v_start_local::date>v_today+v_max_days then raise exception 'ADVANCE_BOOKING_LIMIT_EXCEEDED'; end if;
 if v_start_local::date<>v_end_local::date or v_start_local::time<v_open or v_end_local::time>v_close then raise exception 'OUTSIDE_OPERATING_HOURS'; end if;
 if not v_is_meeting and not v_student_allowed and not (public.has_role('TEACHER') or public.has_role('ADMIN')) then
  raise exception 'COLD_ROOM_TEACHER_OR_ADMIN_ONLY' using errcode='42501';
 end if;
 v_status:=case when v_policy='MANUAL_APPROVAL' then 'PENDING'::public.booking_status else 'APPROVED'::public.booking_status end;
 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,0));
 if (v_is_meeting and public.meeting_room_has_pending_overlap(p_room_id,p_starts_at,p_ends_at))
 then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
 if exists(select 1 from public.check_room_availability(p_room_id,p_starts_at,p_ends_at) where not available) then
  if v_can_override then
   select b.id into v_displaced from public.bookings b
   where b.room_id=p_room_id and b.status='APPROVED' and not b.is_priority and b.starts_at>now()
     and b.starts_at<p_ends_at and b.ends_at>p_starts_at
   order by b.starts_at limit 1;
  end if;
  if v_displaced is null then raise exception 'ROOM_UNAVAILABLE' using errcode='23P01'; end if;
  -- The override RPC rolls back the displacement if another conflict remains.
  v_override := public.create_priority_booking_override(
   v_displaced,p_starts_at,p_ends_at,p_purpose,'Priority meeting booking'
  );
  update public.bookings set notes=p_notes,requires_key=coalesce(p_requires_key,false)
   where id=(v_override->>'priority_booking_id')::uuid returning * into v_booking;
  perform public.create_notification(v_actor,'BOOKING_CONFIRMED','Booking confirmed',
   'Booking '||v_booking.booking_code||' is confirmed.','booking',v_booking.id);
  return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
 end if;
 insert into public.bookings(requester_id,created_by,beneficiary_user_id,room_id,starts_at,ends_at,purpose,requires_key,notes,status,is_priority)
 values(v_actor,v_actor,v_actor,p_room_id,p_starts_at,p_ends_at,btrim(p_purpose),coalesce(p_requires_key,false),p_notes,v_status,coalesce(v_can_override,false)) returning * into v_booking;
 insert into public.booking_status_history(booking_id,new_status,changed_by,reason) values(v_booking.id,v_status,v_actor,case when v_status='APPROVED' then 'Automatically confirmed by room policy' else 'Manual approval required by room policy' end);
 perform public.write_audit(v_actor,'BOOKING_CREATED','booking',v_booking.id,jsonb_build_object('room_id',p_room_id,'policy',v_policy,'status',v_status));
 perform public.create_notification(v_actor,case when v_status='APPROVED' then 'BOOKING_CONFIRMED' else 'BOOKING_SUBMITTED' end,case when v_status='APPROVED' then 'Booking confirmed' else 'Booking submitted' end,'Booking '||v_booking.booking_code||case when v_status='APPROVED' then ' is confirmed.' else ' is pending approval.' end,'booking',v_booking.id);
 return jsonb_build_object('id',v_booking.id,'booking_code',v_booking.booking_code,'status',v_booking.status);
end $$;

create or replace function public.create_meeting_booking(
 p_room_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_purpose text,p_notes text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not(public.has_role('TEACHER') or public.has_role('ADMIN') or public.has_role('DEAN') or public.has_role('DEPARTMENT_HEAD') or public.has_permission('BOOKING_OVERRIDE')) then
  raise exception 'MEETING_BOOKING_ROLE_REQUIRED' using errcode='42501';
 end if;
 if not exists(select 1 from public.profiles where id=v_actor and account_status='ACTIVE') then raise exception 'ACCOUNT_NOT_ACTIVE' using errcode='42501';end if;
 if nullif(btrim(p_purpose),'') is null or p_ends_at<=p_starts_at then raise exception 'INVALID_BOOKING_INPUT';end if;
 if not exists(select 1 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
  where r.id=p_room_id and r.active and r.booking_enabled and rt.usage_scope='MEETING') then raise exception 'MEETING_ROOM_NOT_AVAILABLE';end if;
 return public.create_booking(p_room_id,p_starts_at,p_ends_at,p_purpose,false,p_notes);
end $$;

-- Classify meeting bookings by the scope used by their booking workflow.
create or replace function public.get_staff_usage_history()
returns table(transaction_id text,source text,room_id uuid,room_code text,room_name text,room_category text,purpose text,user_name text,starts_at timestamptz,ends_at timestamptz,returned_at timestamptz,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not(public.has_permission('REPORT_READ') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query with usage_rows(
  transaction_id,source,room_id,room_code,room_name,room_category,purpose,user_name,starts_at,ends_at,returned_at,status
 ) as (
  select 'booking:'||b.id::text,'BOOKING'::text,r.id,r.code,r.name,'MEETING'::text,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),b.starts_at,b.ends_at,null::timestamptz,b.status::text
  from public.bookings b join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=b.requester_id where rt.usage_scope='MEETING' and b.status in('APPROVED','IN_USE','COMPLETED')
  union all
  select 'key-request:'||k.id::text,'KEY_REQUEST',r.id,r.code,r.name,rt.report_category,case when k.status='REJECTED' then coalesce(k.decision_reason,k.purpose) else k.purpose end,coalesce(nullif(k.requester_name,''),p.full_name,k.requester_email,'ไม่ระบุ'),k.starts_at,k.ends_at,k.returned_at,k.status
  from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=k.authenticated_user_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and k.status in('PENDING_APPROVAL','APPROVED','REJECTED','IN_USE','RETURNED')
  union all
  select 'key-loan:'||kl.id::text,'KEY_LOAN',r.id,r.code,r.name,rt.report_category,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),coalesce(kl.checked_out_at,b.starts_at),b.ends_at,kl.returned_at,kl.status::text
  from public.key_loans kl join public.bookings b on b.id=kl.booking_id join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=kl.borrower_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and kl.status in('CHECKED_OUT','RETURNED','LATE','LOST','DAMAGED')
 ) select u.* from usage_rows u order by u.starts_at desc,u.transaction_id;
end $$;
