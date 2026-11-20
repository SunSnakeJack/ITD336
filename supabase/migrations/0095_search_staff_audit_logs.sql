-- Search visible audit fields before applying the ten-row page.
create function public.get_staff_audit_logs_search(p_actor text, p_actions text[], p_page integer, p_search text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_search text := lower(nullif(btrim(p_search), ''));
begin
  if auth.uid() is null or not coalesce(public.has_permission('AUDIT_READ'), false) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if (p_actor is not null and p_actor not in ('ADMIN','USER'))
    or char_length(v_search) > 120 or p_page is null or p_page < 1 or coalesce(cardinality(p_actions), 0) > 50 then
    raise exception 'INVALID_FILTER' using errcode = '22023';
  end if;

  return (
    with classified as (
      select l.*, coalesce(l.actor_kind,
        case
          when l.actor_id is not null and l.action in (
            'ADMIN_USER_DIRECTORY_VIEWED', 'ADMIN_USER_PROFILE_UPDATED', 'USER_ROLES_UPDATED',
            'USER_ACCOUNT_STATUS_UPDATED', 'USER_INVITED', 'USER_PREASSIGNED',
            'USER_PREASSIGNMENT_REMOVED', 'USER_REMOVED', 'ROLE_LABEL_CREATE', 'ROLE_LABEL_RENAME', 'ROLE_LABEL_DELETE'
          ) then 'ADMIN'
          when l.actor_id is null and (
            l.metadata->>'anonymous' = 'true' or l.action in ('KEY_REQUEST_TOKEN_CANCEL', 'KEY_REQUEST_TOKEN_RETURN')
          ) then 'USER'
          when p.id is not null then case when exists (
            select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
            where ur.user_id = p.id and r.code = 'ADMIN'
          ) then 'ADMIN' else 'USER' end
        end
      ) as effective_actor_kind,
      l.actor_kind is null and p.id is not null and l.action not in (
        'ADMIN_USER_DIRECTORY_VIEWED', 'ADMIN_USER_PROFILE_UPDATED', 'USER_ROLES_UPDATED',
        'USER_ACCOUNT_STATUS_UPDATED', 'USER_INVITED', 'USER_PREASSIGNED',
        'USER_PREASSIGNMENT_REMOVED', 'USER_REMOVED', 'ROLE_LABEL_CREATE', 'ROLE_LABEL_RENAME', 'ROLE_LABEL_DELETE'
      ) as actor_kind_estimated
      from public.audit_logs l
      left join public.profiles p on p.id = l.actor_id
      where p_actions is null or l.action = any(p_actions)
    ), searchable as (
      select l.id, l.created_at, l.effective_actor_kind, l.actor_kind_estimated,
        l.action, l.entity_type, l.entity_id, l.ip_address,
        coalesce(l.actor_name, nullif(btrim(p.full_name), ''),
          case when l.effective_actor_kind = 'SYSTEM' then 'ระบบ' end) as actor_name,
        coalesce(k.request_code, b.booking_code, r.code, target.full_name,
          left(l.metadata->>'role_code', 40)) as reference,
        left(coalesce(
          nullif(l.metadata->>'reason', ''),
          case when l.action = 'ADMIN_USER_PROFILE_UPDATED' then
            nullif(concat_ws(' ', l.metadata->>'first_name', l.metadata->>'last_name'), '') end,
          case when l.action = 'USER_ROLES_UPDATED' and jsonb_typeof(l.metadata->'new_roles') = 'array'
            then l.metadata->>'new_roles' end,
          l.metadata->>'status', l.metadata->>'name', l.metadata->>'source'
        ), 300) as detail,
        coalesce(r.code, request_room.code, booking_room.code, loan_room.code) as room_code,
        loan_booking.booking_code as loan_booking_code
      from classified l
      left join public.profiles p on p.id = l.actor_id
      left join public.profiles target on l.entity_type = 'profile' and target.id = l.entity_id
      left join public.key_requests k on l.entity_type = 'key_request' and k.id = l.entity_id
      left join public.bookings b on l.entity_type = 'booking' and b.id = l.entity_id
      left join public.rooms r on l.entity_type = 'room' and r.id = l.entity_id
      left join public.rooms request_room on request_room.id = k.room_id
      left join public.rooms booking_room on booking_room.id = b.room_id
      left join public.key_loans loan on l.entity_type = 'key_loan' and loan.id = l.entity_id
      left join public.rooms loan_room on loan_room.id = loan.room_id
      left join public.bookings loan_booking on loan_booking.id = loan.booking_id
      where p_actor is null or l.effective_actor_kind = p_actor
    ), matching as (
      select * from searchable s
      where v_search is null
        or strpos(lower(concat_ws(' ', s.actor_name, s.reference, s.room_code,
          s.loan_booking_code, s.detail)), v_search) > 0
    ), page_rows as (
      select * from matching order by created_at desc, id desc
      limit 10 offset (p_page::bigint - 1) * 10
    )
    select jsonb_build_object('total', (select count(*) from matching), 'rows',
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id::text, 'createdAt', l.created_at,
        'actorName', l.actor_name, 'actorKind', l.effective_actor_kind,
        'actorKindEstimated', l.actor_kind_estimated,
        'action', l.action, 'entityType', l.entity_type, 'entityId', l.entity_id,
        'reference', l.reference, 'detail', l.detail, 'ip', host(l.ip_address)
      ) order by l.created_at desc, l.id desc) from page_rows l), '[]'::jsonb))
  );
end
$$;

revoke all on function public.get_staff_audit_logs_search(text, text[], integer, text) from public, anon, authenticated;
grant execute on function public.get_staff_audit_logs_search(text, text[], integer, text) to authenticated;

create or replace function public.get_staff_audit_logs(p_actor text, p_actions text[], p_page integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select public.get_staff_audit_logs_search(p_actor, p_actions, p_page, null)
$$;
