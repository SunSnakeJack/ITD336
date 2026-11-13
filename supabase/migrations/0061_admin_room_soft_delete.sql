-- Permission-checked room activation toggle used for recoverable soft deletion.
create or replace function public.set_admin_room_active(p_room_id uuid,p_active boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_room_id uuid;v_code text;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if not public.has_permission('ROOM_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 update public.rooms set active=p_active where id=p_room_id returning id,code into v_room_id,v_code;
 if v_room_id is null then raise exception 'ROOM_NOT_FOUND';end if;
 perform public.write_audit(v_actor,case when p_active then 'ROOM_REACTIVATED' else 'ROOM_DEACTIVATED' end,'room',v_room_id,jsonb_build_object('code',v_code,'active',p_active));
 return v_room_id;
end $$;
revoke all on function public.set_admin_room_active(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_admin_room_active(uuid,boolean) to authenticated;
