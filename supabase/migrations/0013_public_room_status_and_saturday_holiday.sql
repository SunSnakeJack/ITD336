-- Expose room availability safely to guests and enforce the confirmed Saturday holiday.

drop function public.get_public_room_catalog();
create function public.get_public_room_catalog()
returns table(
 id uuid,code text,name text,room_type_name text,building text,floor text,
 capacity integer,active boolean,academic_schedule_confirmed boolean
)
language sql stable security definer set search_path='' as $$
 select r.id,r.code,r.name,rt.name,r.building,r.floor,r.capacity,r.active,r.academic_schedule_confirmed
 from public.rooms r join public.room_types rt on rt.id=r.room_type_id
 order by r.code
$$;

revoke all on function public.get_public_room_catalog() from public;
grant execute on function public.get_public_room_catalog() to anon,authenticated;

insert into public.booking_rules(rule_key,rule_value,description)
values ('CLOSED_WEEKDAYS','[6]'::jsonb,'Confirmed weekly closure; PostgreSQL day 6 is Saturday')
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description,active=true;

create or replace function public.reject_closed_weekday_schedule()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.active and new.status='ACTIVE' and new.day_of_week=6 then
  raise exception 'SATURDAY_IS_CLOSED' using errcode='22023';
 end if;
 return new;
end $$;

drop trigger if exists reject_closed_weekday_schedule on public.class_schedules;
create trigger reject_closed_weekday_schedule
before insert or update of day_of_week,active,status on public.class_schedules
for each row execute function public.reject_closed_weekday_schedule();
