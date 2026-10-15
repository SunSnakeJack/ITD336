-- Configurable academic terms used as the effective range for recurring classes.

create table public.academic_terms (
 id uuid primary key default gen_random_uuid(),
 academic_year text not null check(nullif(btrim(academic_year),'') is not null),
 term_code text not null check(nullif(btrim(term_code),'') is not null),
 starts_on date not null,
 ends_on date not null,
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint academic_terms_date_check check(ends_on>=starts_on),
 constraint academic_terms_year_code_key unique(academic_year,term_code)
);

create trigger set_academic_terms_updated_at before update on public.academic_terms
for each row execute function public.set_updated_at();

alter table public.academic_terms enable row level security;
create policy "authenticated read academic terms" on public.academic_terms
for select to authenticated using(true);
revoke all on public.academic_terms from anon,authenticated;
grant select on public.academic_terms to authenticated;

create or replace function public.upsert_academic_term(
 p_term_id uuid,p_academic_year text,p_term_code text,p_starts_on date,p_ends_on date,p_active boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_id uuid; v_before jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000'; end if;
 if not public.has_permission('SETTINGS_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501'; end if;
 if nullif(btrim(p_academic_year),'') is null or nullif(btrim(p_term_code),'') is null or p_ends_on<p_starts_on then
  raise exception 'INVALID_ACADEMIC_TERM' using errcode='22023';
 end if;
 if p_term_id is null then
  insert into public.academic_terms(academic_year,term_code,starts_on,ends_on,active)
  values(btrim(p_academic_year),btrim(p_term_code),p_starts_on,p_ends_on,p_active) returning id into v_id;
  perform public.write_audit(v_actor,'ACADEMIC_TERM_CREATED','academic_term',v_id,
   jsonb_build_object('academic_year',btrim(p_academic_year),'term_code',btrim(p_term_code),'starts_on',p_starts_on,'ends_on',p_ends_on));
 else
  select to_jsonb(t) into v_before from public.academic_terms t where t.id=p_term_id for update;
  if v_before is null then raise exception 'ACADEMIC_TERM_NOT_FOUND' using errcode='P0002'; end if;
  update public.academic_terms set academic_year=btrim(p_academic_year),term_code=btrim(p_term_code),
   starts_on=p_starts_on,ends_on=p_ends_on,active=p_active where id=p_term_id returning id into v_id;
  perform public.write_audit(v_actor,'ACADEMIC_TERM_UPDATED','academic_term',v_id,
   jsonb_build_object('before',v_before,'academic_year',btrim(p_academic_year),'term_code',btrim(p_term_code),'starts_on',p_starts_on,'ends_on',p_ends_on,'active',p_active));
 end if;
 return v_id;
end $$;

revoke all on function public.upsert_academic_term(uuid,text,text,date,date,boolean) from public,anon;
grant execute on function public.upsert_academic_term(uuid,text,text,date,date,boolean) to authenticated;
