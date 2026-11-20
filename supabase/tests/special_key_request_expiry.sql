begin;

do $$
declare
  v_start timestamptz := '2026-11-19 17:30:00+07';
  v_end timestamptz := '2026-11-19 18:00:00+07';
begin
  assert public.special_key_request_display_status('PENDING_APPROVAL', 'SPECIAL_LAB', v_start, v_end, v_start - interval '1 second') = 'PENDING_APPROVAL';
  assert public.special_key_request_display_status('PENDING_APPROVAL', 'SPECIAL_LAB', v_start, v_end, v_start) = 'PENDING_STARTED';
  assert public.special_key_request_display_status('PENDING_APPROVAL', 'SPECIAL_LAB', v_start, v_end, v_end - interval '1 second') = 'PENDING_STARTED';
  assert public.special_key_request_display_status('PENDING_APPROVAL', 'SPECIAL_LAB', v_start, v_end, v_end) = 'EXPIRED';
  assert public.special_key_request_display_status('APPROVED', 'SPECIAL_LAB', v_start, v_end, v_end) = 'APPROVED';
  assert public.special_key_request_display_status('PENDING_APPROVAL', 'GENERAL_LAB', v_start, v_end, v_end) = 'PENDING_APPROVAL';
end
$$;

rollback;
