-- Expose only the room IDs closed today, within the caller's public catalog.
create function public.get_public_rooms_closed_today()
returns uuid[]
language sql stable security definer set search_path=''
as $$
 select coalesce(array_agg(r.id), '{}'::uuid[])
 from public.get_public_room_catalog() r
 cross join (select (now() at time zone 'Asia/Bangkok')::date as today) d
 left join public.room_category_restrictions p on p.category=public.room_policy_category(r.id)
 where case
   when extract(dow from d.today)=6 then public.get_open_saturday() is distinct from d.today::text
   else p.policy ? 'days' and not (p.policy->'days' @> jsonb_build_array(extract(dow from d.today)::int))
 end
$$;

revoke all on function public.get_public_rooms_closed_today() from public,anon,authenticated;
grant execute on function public.get_public_rooms_closed_today() to anon,authenticated;
