-- Publish only the login requirement for labs visible to the caller.
create function public.get_public_key_login_required_rooms()
returns uuid[]
language sql stable security definer set search_path=''
as $$
 select coalesce(array_agg(r.id), '{}'::uuid[])
 from public.get_public_room_catalog() r
 left join public.room_category_restrictions p on p.category=public.room_policy_category(r.id)
 where r.usage_scope='LABORATORY'
   and (r.requires_sso_for_key_request or coalesce((p.policy->>'loginForKey')::boolean,false))
$$;

revoke all on function public.get_public_key_login_required_rooms() from public,anon,authenticated;
grant execute on function public.get_public_key_login_required_rooms() to anon,authenticated;
