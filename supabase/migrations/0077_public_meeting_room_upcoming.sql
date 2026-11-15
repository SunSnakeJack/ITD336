-- Publish the five nearest future bookings with their approval state.
create function public.get_public_meeting_room_upcoming(p_room_id uuid)
returns table(starts_at timestamptz, ends_at timestamptz, category text, pending boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_can_view boolean;
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
    end, b.status = 'PENDING'
    from public.bookings b
    cross join lateral (
      select array_agg(r.code) as roles
      from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = b.requester_id
    ) actor
    where b.room_id = p_room_id and b.status in ('APPROVED', 'PENDING')
      and b.starts_at >= now()
    order by b.starts_at, b.ends_at, b.id
    limit 5;
end;
$$;

revoke all on function public.get_public_meeting_room_upcoming(uuid) from public;
grant execute on function public.get_public_meeting_room_upcoming(uuid) to anon, authenticated;
