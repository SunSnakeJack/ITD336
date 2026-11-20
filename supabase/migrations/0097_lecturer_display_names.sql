create table private.lecturer_display_names (
  email text primary key check (email = lower(btrim(email)) and email <> ''),
  name_th text check (length(name_th) <= 160),
  name_en text check (length(name_en) <= 160)
);

alter table private.lecturer_display_names enable row level security;
revoke all on private.lecturer_display_names from public, anon, authenticated;

-- Reuse the Thai lecturer names and any English names already registered
-- under the same email. Other roster entries keep their original name.
insert into private.lecturer_display_names(email, name_th, name_en)
select l.email, l.name, (
  select btrim(p.full_name) from public.profiles p
  where lower(btrim(p.email)) = l.email and p.deleted_at is null
    and btrim(p.full_name) ~ '^[A-Za-z]' and position('@' in p.full_name) = 0
    and length(btrim(p.full_name)) <= 160
  order by p.id limit 1
)
from public.key_request_lecturers l
where l.active and l.email like '%@northbkk.ac.th';

create function public.get_lecturer_name_language()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case when rule_value = '"en"'::jsonb then 'en' else 'th' end
    from public.booking_rules where rule_key = 'LECTURER_NAME_LANGUAGE' and active
  ), 'th');
$$;

create function public.set_lecturer_name_language(p_language text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_rule_id uuid;
begin
  if v_actor is null or not public.has_role('ADMIN') or not public.has_permission('SETTINGS_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_language is null or p_language not in ('th', 'en') then
    raise exception 'INVALID_LECTURER_NAME_LANGUAGE' using errcode = '22023';
  end if;

  insert into public.booking_rules(rule_key, rule_value, description, active, updated_by)
  values ('LECTURER_NAME_LANGUAGE', to_jsonb(p_language), 'Lecturer display name language', true, v_actor)
  on conflict (rule_key) do update set
    rule_value = excluded.rule_value, active = true, updated_by = v_actor, updated_at = now()
  returning id into v_rule_id;
  perform public.write_audit(v_actor, 'LECTURER_NAME_LANGUAGE_UPDATED', 'booking_rule',
    v_rule_id, jsonb_build_object('language', p_language));
  return p_language;
end;
$$;

create function public.get_admin_lecturer_display_names()
returns table(email text, name_th text, name_en text)
language sql stable security definer set search_path = '' as $$
  select n.email, n.name_th, n.name_en
  from private.lecturer_display_names n
  where auth.uid() is not null and public.has_role('ADMIN');
$$;

create function public.set_admin_lecturer_display_names(
  p_user_id uuid, p_pending_registration boolean, p_name_th text, p_name_en text
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
begin
  if v_actor is null or not public.has_role('ADMIN') or not public.has_permission('SETTINGS_MANAGE') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select lower(btrim(d.email)) into v_email
  from public.get_admin_user_directory_v3() d
  where d.user_id = p_user_id and d.pending_registration = p_pending_registration
    and 'TEACHER' = any(d.role_codes);
  if not found then raise exception 'LECTURER_NOT_FOUND'; end if;

  insert into private.lecturer_display_names(email, name_th, name_en)
  values (v_email, nullif(btrim(p_name_th), ''), nullif(btrim(p_name_en), ''))
  on conflict (email) do update set name_th = excluded.name_th, name_en = excluded.name_en;
  perform public.write_audit(v_actor, 'LECTURER_DISPLAY_NAMES_UPDATED', 'lecturer_display_name',
    p_user_id, '{}'::jsonb);
end;
$$;

create function public.get_public_key_request_lecturers_v2()
returns table(id uuid, lecturer_name text, name_th text, name_en text)
language sql stable security definer set search_path = '' as $$
  select l.id,
    coalesce(case public.get_lecturer_name_language() when 'en' then n.name_en else n.name_th end, l.name),
    n.name_th, n.name_en
  from private.key_request_lecturer_directory() l
  left join private.lecturer_display_names n on n.email = l.email
  order by 2, l.id;
$$;

revoke all on function public.get_lecturer_name_language(),
  public.set_lecturer_name_language(text), public.get_admin_lecturer_display_names(),
  public.set_admin_lecturer_display_names(uuid, boolean, text, text),
  public.get_public_key_request_lecturers_v2() from public, anon, authenticated;
grant execute on function public.get_lecturer_name_language(),
  public.get_public_key_request_lecturers_v2() to anon, authenticated;
grant execute on function public.set_lecturer_name_language(text),
  public.get_admin_lecturer_display_names(),
  public.set_admin_lecturer_display_names(uuid, boolean, text, text) to authenticated;
