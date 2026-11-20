-- Replace the existing RPC bodies while preserving their signatures and grants.
create or replace function public.get_key_catalog_display()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when rule_value = '"key-tags"'::jsonb then 'key-tags'
      when rule_value = '"current-no-history"'::jsonb then 'current-no-history'
      else 'current'
    end
    from public.booking_rules where rule_key = 'KEY_CATALOG_DISPLAY' and active
  ), 'current');
$$;

create or replace function public.set_key_catalog_display(p_mode text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_rule_id uuid;
begin
  if v_actor is null or not public.has_role('ADMIN')
     or not public.has_permission('SETTINGS_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_mode is null or p_mode not in ('current', 'key-tags', 'current-no-history') then
    raise exception 'INVALID_KEY_CATALOG_DISPLAY' using errcode = '22023';
  end if;

  insert into public.booking_rules(rule_key, rule_value, description, active, updated_by)
  values ('KEY_CATALOG_DISPLAY', to_jsonb(p_mode), 'Public key catalog layout', true, v_actor)
  on conflict (rule_key) do update set
    rule_value = excluded.rule_value, active = true, updated_by = v_actor, updated_at = now()
  returning id into v_rule_id;
  perform public.write_audit(v_actor, 'KEY_CATALOG_DISPLAY_UPDATED', 'booking_rule',
    v_rule_id, jsonb_build_object('mode', p_mode));
  return p_mode;
end;
$$;
