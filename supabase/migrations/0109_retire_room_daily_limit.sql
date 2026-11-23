-- The daily limit is retired from the settings UI. Preserve prior values in the audit log.
insert into public.audit_logs(actor_id,action,entity_type,metadata)
select null,'ROOM_CATEGORY_DAILY_LIMIT_REMOVED','room_category',
       jsonb_build_object('name',category,'before',policy->'dailyLimit')
from public.room_category_restrictions where policy ? 'dailyLimit';

update public.room_category_restrictions set policy = policy - 'dailyLimit' where policy ? 'dailyLimit';

create function public.strip_retired_room_daily_limit()
returns trigger language plpgsql set search_path='' as $$
begin
 new.policy := new.policy - 'dailyLimit';
 return new;
end $$;
create trigger strip_retired_room_daily_limit before insert or update of policy
on public.room_category_restrictions for each row execute function public.strip_retired_room_daily_limit();
revoke all on function public.strip_retired_room_daily_limit() from public,anon,authenticated;
