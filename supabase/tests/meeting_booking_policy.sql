-- Run on a disposable database with the standard seed and migrations.
begin;
set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';

do $$
begin
  begin
    perform public.set_meeting_advance_booking_days(7);
    raise exception 'Student was allowed to set the booking limit';
  exception when insufficient_privilege then null;
  end;
end
$$;

set local "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000004';

do $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_saturday date := v_today + ((12 - extract(dow from v_today)::integer) % 7 + 1);
  v_dates date[];
begin
  perform public.set_open_saturday(null);
  perform public.set_meeting_advance_booking_days(1);
  select allowed_dates into v_dates from public.get_meeting_booking_policy();
  assert cardinality(v_dates) = 1 and v_dates[1] > v_today, 'One-day boundary';

  perform public.set_meeting_advance_booking_days(30);
  select allowed_dates into v_dates from public.get_meeting_booking_policy();
  assert cardinality(v_dates) = 30 and not (v_saturday = any(v_dates)), 'Thirty days excluding closed Saturdays';

  perform public.set_open_saturday(v_saturday);
  select allowed_dates into v_dates from public.get_meeting_booking_policy();
  assert cardinality(v_dates) = 30 and v_saturday = any(v_dates), 'Open Saturday counts toward the limit';

  begin
    perform public.set_meeting_advance_booking_days(31);
    raise exception 'Invalid booking limit was accepted';
  exception when invalid_parameter_value then null;
  end;
end
$$;

rollback;
