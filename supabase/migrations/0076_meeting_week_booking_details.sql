-- Expose private booking detail fields only to the requester and booking operators.
create or replace function public.get_public_meeting_room_week(p_room_id uuid, p_week_start date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_week date := v_today - extract(dow from v_today)::integer;
  v_from timestamptz;
  v_until timestamptz;
  v_can_view boolean;
  v_actor uuid := auth.uid();
  v_can_manage boolean := v_actor is not null and (public.has_permission('BOOKING_MANAGE') or public.has_permission('BOOKING_APPROVE'));
begin
  if p_week_start is null or p_week_start not in (v_week - 7, v_week, v_week + 7) then
    raise exception 'INVALID_MEETING_WEEK' using errcode = '22023';
  end if;

  select case when auth.uid() is null then coalesce(p.guest_view_schedule, true)
    when public.has_role('STUDENT') then coalesce(p.student_view_schedule, true)
    else true end into v_can_view
  from public.rooms r
  join public.room_types t on t.id = r.room_type_id
  left join public.room_usage_policies p on p.room_id = r.id
  where r.id = p_room_id and r.active and t.usage_scope = 'MEETING';

  if not coalesce(v_can_view, false) then
    raise exception 'SCHEDULE_POLICY_DENIED' using errcode = '42501';
  end if;

  v_from := p_week_start::timestamp at time zone 'Asia/Bangkok';
  v_until := (p_week_start + 7)::timestamp at time zone 'Asia/Bangkok';

  return (
    with events as (
      select b.starts_at, b.ends_at, case
        when b.is_priority or 'DEAN' = any(actor.roles) or 'DEPARTMENT_HEAD' = any(actor.roles) then 'LEADERSHIP'
        when 'TEACHER' = any(actor.roles) then 'TEACHER'
        else 'OTHER'
      end as category,
        case when v_can_manage or b.requester_id = v_actor then p.full_name end as requester_name,
        case when v_can_manage or b.requester_id = v_actor then b.purpose end as purpose
      from public.bookings b
      join public.profiles p on p.id = b.requester_id
      cross join lateral (
        select array_agg(r.code) as roles
        from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_id = b.requester_id
      ) actor
      where b.room_id = p_room_id and b.status in ('PENDING', 'APPROVED', 'IN_USE', 'COMPLETED')
        and b.starts_at < v_until and b.ends_at > v_from
      union all
      select rb.starts_at, rb.ends_at, 'BLOCK', null::text, null::text
      from public.room_blocks rb
      where rb.room_id = p_room_id and rb.starts_at < v_until and rb.ends_at > v_from
    )
    select jsonb_build_object(
      'viewer_id', v_actor,
      'opens_at', coalesce((select (rule_value #>> '{}')::time from public.booking_rules
        where rule_key = 'GENERAL_OPEN_TIME' and active), time '08:30'),
      'closes_at', coalesce((select (rule_value #>> '{}')::time from public.booking_rules
        where rule_key = 'GENERAL_CLOSE_TIME' and active), time '17:30'),
      'events', coalesce((select jsonb_agg(jsonb_strip_nulls(to_jsonb(e)) order by e.starts_at, e.ends_at, e.category)
        from events e), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_public_meeting_room_week(uuid, date) from public;
grant execute on function public.get_public_meeting_room_week(uuid, date) to anon, authenticated;
