-- Retain the report's existing columns and invoker RLS. Add the identifiers
-- needed to display meeting-room loans on their original booking cards.
create or replace view public.key_loan_report_v with (security_invoker=true) as
 select l.id,l.room_id,r.code room_code,l.key_id,k.key_code,l.borrower_id,l.usage_source,l.status,
  l.checked_out_at,l.expected_return_at,l.user_reported_return_at,l.returned_at,b.starts_at available_from,
  (l.expected_return_at is not null and coalesce(l.user_reported_return_at,l.returned_at,now())>l.expected_return_at
   and l.status in ('CHECKED_OUT','LATE','RETURN_REPORTED')) overdue,
  l.booking_id,rt.usage_scope
 from public.key_loans l
 join public.rooms r on r.id=l.room_id
 left join public.room_types rt on rt.id=r.room_type_id
 left join public.room_keys k on k.id=l.key_id
 left join public.bookings b on b.id=l.booking_id;
