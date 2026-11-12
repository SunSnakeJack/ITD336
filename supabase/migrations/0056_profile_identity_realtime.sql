-- Refresh authenticated identity displays when roles or account status change.
create or replace function public.touch_profile_after_role_change()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.profiles set updated_at=now() where id=coalesce(new.user_id,old.user_id);
 return coalesce(new,old);
end $$;
drop trigger if exists touch_profile_after_role_change on public.user_roles;
create trigger touch_profile_after_role_change after insert or update or delete on public.user_roles
for each row execute function public.touch_profile_after_role_change();
revoke all on function public.touch_profile_after_role_change() from public,anon,authenticated;

do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then
  alter publication supabase_realtime add table public.profiles;
 end if;
end $$;
