create function public.get_staff_usage_report_details()
returns table(transaction_id text, user_key text, user_type text, checked_out_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select usage.transaction_id,
    case
      when identity.user_id is not null then md5(identity.user_id::text)
      when nullif(btrim(request.requester_email), '') is not null
        then 'guest:' || dense_rank() over (order by lower(btrim(request.requester_email)))::text
      else usage.transaction_id
    end,
    coalesce(assigned.code, request.requester_type, 'UNKNOWN'),
    loan.checked_out_at
  from public.get_staff_usage_history() usage
  left join public.key_requests request on usage.source = 'KEY_REQUEST'
    and request.id = split_part(usage.transaction_id, ':', 2)::uuid
  left join public.key_loans loan on usage.source = 'KEY_LOAN'
    and loan.id = split_part(usage.transaction_id, ':', 2)::uuid
  left join public.bookings booking on usage.source = 'BOOKING'
    and booking.id = split_part(usage.transaction_id, ':', 2)::uuid
  cross join lateral (select coalesce(request.authenticated_user_id, loan.borrower_id, booking.requester_id) as user_id) identity
  left join lateral (
    select r.code
    from public.user_roles ur join public.roles r on r.id = ur.role_id
    join unnest(array['ADMIN', 'DEAN', 'DEPARTMENT_HEAD', 'STAFF', 'TEACHER', 'STUDENT'])
      with ordinality as priority(code, position) on priority.code = r.code
    where ur.user_id = identity.user_id
    order by priority.position limit 1
  ) assigned on true
  where auth.uid() is not null
    and (public.has_permission('REPORT_READ') or public.has_permission('ROOM_MANAGE'));
$$;

revoke all on function public.get_staff_usage_report_details() from public, anon, authenticated;
grant execute on function public.get_staff_usage_report_details() to authenticated;
