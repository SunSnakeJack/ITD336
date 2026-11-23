create function public.get_public_navigation_mode()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select rule_value #>> '{}'
    from public.booking_rules
    where rule_key = 'PUBLIC_NAVIGATION_MODE' and active
      and (rule_value #>> '{}') in ('top', 'bottom', 'both')
  ), 'top');
$$;

create function public.set_public_navigation_mode(p_mode text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_rule_id uuid;
begin
  if v_actor is null or not public.has_role('ADMIN') or not public.has_permission('SETTINGS_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('top', 'bottom', 'both') then
    raise exception 'INVALID_NAVIGATION_MODE' using errcode = '22023';
  end if;
  insert into public.booking_rules(rule_key, rule_value, description, active, updated_by)
  values ('PUBLIC_NAVIGATION_MODE', to_jsonb(p_mode), 'Navigation displayed in the public layout', true, v_actor)
  on conflict (rule_key) do update set
    rule_value = excluded.rule_value, active = true, updated_by = v_actor, updated_at = now()
  returning id into v_rule_id;
  perform public.write_audit(v_actor, 'PUBLIC_NAVIGATION_MODE_UPDATED', 'booking_rule',
    v_rule_id, jsonb_build_object('mode', p_mode));
  return p_mode;
end;
$$;

revoke all on function public.get_public_navigation_mode(), public.set_public_navigation_mode(text) from public, anon, authenticated;
grant execute on function public.get_public_navigation_mode() to anon, authenticated;
grant execute on function public.set_public_navigation_mode(text) to authenticated;
