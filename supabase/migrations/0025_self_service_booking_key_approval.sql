-- Booking-derived key requests are automatically approved for borrower self-service.
insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
select l.id,'REQUESTED','APPROVED',l.requested_by,'Automatically approved by self-service migration'
from public.key_loans l join public.bookings b on b.id=l.booking_id
where l.usage_source='BOOKING' and l.status='REQUESTED' and b.status in('APPROVED','IN_USE');

select public.write_audit(l.requested_by,'KEY_REQUEST_AUTO_APPROVED','key_loan',l.id,jsonb_build_object('booking_id',l.booking_id,'migration','0025'))
from public.key_loans l join public.bookings b on b.id=l.booking_id
where l.usage_source='BOOKING' and l.status='REQUESTED' and b.status in('APPROVED','IN_USE');

update public.key_loans l set status='APPROVED',approved_at=now(),approved_by=l.requested_by,authorized_by=l.requested_by,
 expected_return_at=coalesce(l.expected_return_at,b.ends_at)
from public.bookings b where b.id=l.booking_id and l.usage_source='BOOKING' and l.status='REQUESTED' and b.status in('APPROVED','IN_USE');

create or replace function public.ensure_key_request_for_booking()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_loan_id uuid;v_borrower uuid;
begin
 if new.status='APPROVED' and new.requires_key and (tg_op='INSERT' or old.status is distinct from new.status)
    and not exists(select 1 from public.key_loans where booking_id=new.id and status in('REQUESTED','APPROVED','CHECKED_OUT','LATE','RETURN_REPORTED')) then
  v_borrower:=coalesce(new.beneficiary_user_id,new.requester_id);
  insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,expected_return_at)
  values(new.id,new.room_id,'BOOKING',v_borrower,new.requester_id,new.requester_id,'APPROVED',now(),new.requester_id,new.ends_at) returning id into v_loan_id;
  insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan_id,'APPROVED',new.requester_id,'Automatically approved with booking');
  perform public.write_audit(new.requester_id,'KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan_id,jsonb_build_object('booking_id',new.id));
 end if;
 return new;
end $$;

create or replace function public.request_booking_key(p_booking_id uuid,p_notes text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;v_loan public.key_loans;v_policy public.room_usage_policies;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND';end if;
 if v_booking.requester_id<>v_actor and v_booking.beneficiary_user_id is distinct from v_actor then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if v_booking.status not in('APPROVED','IN_USE') then raise exception 'BOOKING_NOT_ELIGIBLE_FOR_KEY';end if;
 if (v_booking.starts_at at time zone 'Asia/Bangkok')::date>(now() at time zone 'Asia/Bangkok')::date then raise exception 'KEY_NOT_AVAILABLE_BEFORE_BOOKING_DATE';end if;
 select * into v_policy from public.room_usage_policies where room_id=v_booking.room_id;
 if public.has_role('STUDENT') and not coalesce(v_policy.student_own_booking_key,true) then raise exception 'KEY_POLICY_DENIED' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_booking.room_id::text,4));
 if exists(select 1 from public.key_loans l where l.room_id=v_booking.room_id and l.status in('CHECKED_OUT','LATE')) then raise exception 'ROOM_KEY_ALREADY_CHECKED_OUT' using errcode='23505';end if;
 update public.bookings set requires_key=true where id=p_booking_id;
 insert into public.key_loans(booking_id,room_id,usage_source,borrower_id,requested_by,authorized_by,status,approved_at,approved_by,expected_return_at,notes)
 values(p_booking_id,v_booking.room_id,'BOOKING',coalesce(v_booking.beneficiary_user_id,v_booking.requester_id),v_actor,v_actor,'APPROVED',now(),v_actor,v_booking.ends_at,nullif(btrim(p_notes),'')) returning * into v_loan;
 insert into public.key_loan_history(key_loan_id,new_status,changed_by,notes) values(v_loan.id,'APPROVED',v_actor,'Automatically approved from owned booking');
 perform public.write_audit(v_actor,'KEY_REQUEST_AUTO_APPROVED','key_loan',v_loan.id,jsonb_build_object('booking_id',p_booking_id));
 return jsonb_build_object('id',v_loan.id,'status',v_loan.status);
exception when unique_violation then raise exception 'ACTIVE_KEY_REQUEST_ALREADY_EXISTS';
end $$;

revoke all on function public.request_booking_key(uuid,text) from public,anon;
grant execute on function public.request_booking_key(uuid,text) to authenticated;
