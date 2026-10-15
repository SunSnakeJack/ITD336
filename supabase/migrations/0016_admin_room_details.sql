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
