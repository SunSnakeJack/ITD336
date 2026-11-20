create function public.get_show_elapsed_room_slots()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select rule_value is distinct from 'false'::jsonb
    from public.booking_rules where rule_key = 'SHOW_ELAPSED_ROOM_SLOTS' and active
  ), true);
$$;

create function public.set_show_elapsed_room_slots(p_show boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_rule_id uuid;
begin
  if v_actor is null or not public.has_role('ADMIN') or not public.has_permission('SETTINGS_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_show is null then raise exception 'INVALID_DISPLAY_SETTING' using errcode = '22023'; end if;
  insert into public.booking_rules(rule_key, rule_value, description, active, updated_by)
  values ('SHOW_ELAPSED_ROOM_SLOTS', to_jsonb(p_show), 'Show elapsed slots on daily room schedules', true, v_actor)
  on conflict (rule_key) do update set
    rule_value = excluded.rule_value, active = true, updated_by = v_actor, updated_at = now()
  returning id into v_rule_id;
  perform public.write_audit(v_actor, 'ROOM_SCHEDULE_DISPLAY_UPDATED', 'booking_rule',
    v_rule_id, jsonb_build_object('show_elapsed', p_show));
  return p_show;
end;
$$;

revoke all on function public.get_show_elapsed_room_slots(), public.set_show_elapsed_room_slots(boolean)
from public, anon, authenticated;
grant execute on function public.get_show_elapsed_room_slots() to anon, authenticated;
grant execute on function public.set_show_elapsed_room_slots(boolean) to authenticated;
