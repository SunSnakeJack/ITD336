create function public.get_open_saturday()
returns text language sql stable security definer set search_path='' as $$
 select setting_value #>> '{}' from public.system_settings
 where setting_key='OPEN_SATURDAY'
 and setting_value #>> '{}' >= ((now() at time zone 'Asia/Bangkok')::date)::text
$$;

create function public.set_open_saturday(p_date date)
returns text language plpgsql security definer set search_path='' as $$
declare v_actor uuid := auth.uid();
begin
 if v_actor is null or not public.has_permission('SETTINGS_MANAGE') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_date is not null and (extract(dow from p_date)<>6 or p_date<(now() at time zone 'Asia/Bangkok')::date) then
  raise exception 'INVALID_SATURDAY_DATE' using errcode='22023';
 end if;
 insert into public.system_settings(setting_key,setting_value,description,updated_by,updated_at)
 values('OPEN_SATURDAY',coalesce(to_jsonb(p_date),'null'::jsonb),'Single Bangkok Saturday allowed for room bookings and key requests',v_actor,now())
 on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_by=v_actor,updated_at=now();
 perform public.write_audit(v_actor,'OPEN_SATURDAY_UPDATED','system_setting',null,jsonb_build_object('date',p_date));
 return p_date::text;
end $$;

create function public.enforce_saturday_booking_exception()
returns trigger language plpgsql set search_path='' as $$
declare
 v_start date := (new.starts_at at time zone 'Asia/Bangkok')::date;
 v_end date := (new.ends_at at time zone 'Asia/Bangkok')::date;
 v_first_saturday date := v_start + ((6-extract(dow from v_start)::integer+7)%7);
begin
 if tg_op='UPDATE' then
  if new.starts_at is not distinct from old.starts_at and new.ends_at is not distinct from old.ends_at then return new;end if;
 end if;
 if v_first_saturday<=v_end and (
  public.get_open_saturday() is distinct from v_first_saturday::text or v_first_saturday+7<=v_end
 ) then
  raise exception 'SATURDAY_NOT_AVAILABLE' using errcode='22023';
 end if;
 return new;
end $$;

create trigger enforce_saturday_booking_exception before insert or update of starts_at,ends_at on public.bookings
for each row execute function public.enforce_saturday_booking_exception();
create trigger enforce_saturday_booking_exception before insert or update of starts_at,ends_at on public.key_requests
for each row execute function public.enforce_saturday_booking_exception();

-- The unified trigger checks Saturday for both tables. Preserve existing email and service hours rules.
create or replace function public.enforce_key_request_entry_rules()
returns trigger language plpgsql set search_path='' as $$
begin
 new.requester_email := lower(btrim(new.requester_email));
 if new.requester_email !~ '^[^@[:space:]]+@northbkk[.]ac[.]th$' then
  raise exception 'UNIVERSITY_EMAIL_REQUIRED' using errcode='22023';
 end if;
 if (new.starts_at at time zone 'Asia/Bangkok')::time < time '08:00'
    or (new.ends_at at time zone 'Asia/Bangkok')::time > time '18:00' then
  raise exception 'OUTSIDE_SERVICE_HOURS' using errcode='22023';
 end if;
 return new;
end $$;

revoke all on function public.get_open_saturday(),public.set_open_saturday(date),public.enforce_saturday_booking_exception() from public,anon,authenticated;
grant execute on function public.get_open_saturday() to anon,authenticated,service_role;
grant execute on function public.set_open_saturday(date) to authenticated;
