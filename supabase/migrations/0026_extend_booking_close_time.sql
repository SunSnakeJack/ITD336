-- The final visible 17:30 slot represents 17:30-18:30, so the booking window must end at 18:30.
insert into public.booking_rules(rule_key,rule_value,description,active,updated_at)
values('GENERAL_CLOSE_TIME','"18:30"','Confirmed local closing time; permits the final 17:30-18:30 slot in Asia/Bangkok',true,now())
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description,active=true,updated_at=now();
