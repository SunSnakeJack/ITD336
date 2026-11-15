-- Return five bookings for the selected period with viewer-scoped details.
create function public.get_meeting_room_booking_list(p_room_id uuid, p_upcoming boolean)
returns table(starts_at timestamptz, ends_at timestamptz, category text, pending boolean, viewer_id uuid, requester_name text, purpose text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_can_view boolean;
  v_actor uuid := auth.uid();
  v_can_manage boolean := public.has_permission('BOOKING_MANAGE') or public.has_permission('BOOKING_APPROVE');
begin
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

  return query
    select b.starts_at, b.ends_at, case
      when b.is_priority or 'DEAN' = any(actor.roles) or 'DEPARTMENT_HEAD' = any(actor.roles) then 'LEADERSHIP'
      when 'TEACHER' = any(actor.roles) then 'TEACHER'
      else 'OTHER'
    end, b.status = 'PENDING', v_actor,
      case when v_can_manage or b.requester_id = v_actor then p.full_name end,
      case when v_can_manage or b.requester_id = v_actor then b.purpose end
    from public.bookings b
    join public.profiles p on p.id = b.requester_id
    cross join lateral (
      select array_agg(r.code) as roles
      from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = b.requester_id
    ) actor
    where b.room_id = p_room_id and (
      (p_upcoming and b.status in ('APPROVED', 'PENDING') and b.starts_at >= now())
      or (not p_upcoming and b.status in ('APPROVED', 'IN_USE', 'COMPLETED') and b.ends_at <= now())
    )
    order by case when p_upcoming then b.starts_at end asc,
      case when not p_upcoming then b.starts_at end desc,
      case when p_upcoming then b.ends_at end asc,
      case when not p_upcoming then b.ends_at end desc, b.id
    limit 5;
end;
$$;

revoke all on function public.get_meeting_room_booking_list(uuid, boolean) from public;
grant execute on function public.get_meeting_room_booking_list(uuid, boolean) to anon, authenticated;
