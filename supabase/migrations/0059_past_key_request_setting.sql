-- Configurable exception for same-day elapsed key-request slots.
insert into public.system_settings(setting_key,setting_value,description)
values('ALLOW_PAST_KEY_REQUEST_SLOTS','false'::jsonb,'Allow key requests to start in an elapsed slot on the current Bangkok day')
on conflict(setting_key) do nothing;

create or replace function public.get_key_request_allow_past_slots()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select setting_value::text::boolean from public.system_settings where setting_key='ALLOW_PAST_KEY_REQUEST_SLOTS'),false)
$$;

create or replace function public.get_admin_key_request_timing_setting()
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return public.get_key_request_allow_past_slots();
end $$;

create or replace function public.set_admin_key_request_timing_setting(p_enabled boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 insert into public.system_settings(setting_key,setting_value,description,updated_by,updated_at)
 values('ALLOW_PAST_KEY_REQUEST_SLOTS',to_jsonb(p_enabled),'Allow key requests to start in an elapsed slot on the current Bangkok day',v_actor,now())
 on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_by=v_actor,updated_at=now();
 perform public.write_audit(v_actor,'KEY_REQUEST_TIMING_SETTING_UPDATED','system_setting',null,jsonb_build_object('allow_past_slots',p_enabled));
 return p_enabled;
end $$;

create or replace function public.enforce_key_request_elapsed_slot_setting()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not public.get_key_request_allow_past_slots() and new.starts_at<now() then
  raise exception 'KEY_REQUEST_PAST_SLOT_DISABLED' using errcode='22007';
 end if;
 return new;
end $$;

drop trigger if exists enforce_key_request_elapsed_slot_setting on public.key_requests;
create trigger enforce_key_request_elapsed_slot_setting before insert on public.key_requests
for each row execute function public.enforce_key_request_elapsed_slot_setting();

revoke all on function public.get_key_request_allow_past_slots(),public.get_admin_key_request_timing_setting(),public.set_admin_key_request_timing_setting(boolean) from public,anon,authenticated;
grant execute on function public.get_key_request_allow_past_slots() to anon,authenticated;
grant execute on function public.get_admin_key_request_timing_setting(),public.set_admin_key_request_timing_setting(boolean) to authenticated;

comment on function public.get_key_request_allow_past_slots() is 'Privacy-safe public timing policy used by the key request UI and insert guard.';
