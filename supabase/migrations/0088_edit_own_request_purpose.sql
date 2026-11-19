create function public.edit_own_request_purpose(p_id uuid, p_type text, p_purpose text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_purpose text := nullif(btrim(p_purpose), '');
begin
  if v_actor is null or not exists (
    select 1 from public.profiles where id = v_actor and account_status = 'ACTIVE'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_purpose is null then
    raise exception 'PURPOSE_REQUIRED' using errcode = '22023';
  end if;

  if p_type = 'booking' then
    update public.bookings
    set purpose = v_purpose, updated_at = now()
    where id = p_id and requester_id = v_actor and starts_at > clock_timestamp()
      and status in ('PENDING', 'APPROVED');
  elsif p_type = 'key_request' then
    update public.key_requests k
    set purpose = v_purpose, updated_at = now()
    where k.id = p_id and k.starts_at > clock_timestamp()
      and k.purpose_type = 'OTHER'
      and k.status in ('PENDING_APPROVAL', 'APPROVED')
      and (k.authenticated_user_id = v_actor or (k.authenticated_user_id is null and exists (
        select 1 from auth.users u where u.id = v_actor and u.email_confirmed_at is not null
          and lower(u.email) = lower(k.requester_email)
      )));
  else
    raise exception 'INVALID_REQUEST_TYPE' using errcode = '22023';
  end if;
  if not found then
    raise exception 'REQUEST_NOT_EDITABLE' using errcode = '42501';
  end if;
  perform public.write_audit(v_actor, 'REQUEST_PURPOSE_UPDATED', p_type, p_id);
end;
$$;

revoke all on function public.edit_own_request_purpose(uuid, text, text) from public, anon, authenticated;
grant execute on function public.edit_own_request_purpose(uuid, text, text) to authenticated;

create or replace function public.cancel_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED';end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND';end if;
 if v_booking.requester_id<>v_actor and not public.has_permission('BOOKING_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if exists (select 1 from public.key_loans where booking_id=p_booking_id and status in ('CHECKED_OUT','LATE','RETURN_REPORTED')) then raise exception 'BOOKING_KEY_RETURN_REQUIRED';end if;
 if v_booking.ends_at<=now() then raise exception 'BOOKING_ALREADY_ENDED' using errcode='22023';end if;
 if v_booking.status not in('PENDING','APPROVED','IN_USE') then raise exception 'INVALID_BOOKING_TRANSITION';end if;
 update public.bookings set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason=btrim(p_reason) where id=p_booking_id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,v_booking.status,'CANCELLED',v_actor,btrim(p_reason));
 perform public.create_notification(v_booking.requester_id,'BOOKING_CANCELLED','Booking cancelled','Booking '||v_booking.booking_code||' was cancelled.','booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_CANCELLED','booking',p_booking_id,jsonb_build_object('reason',btrim(p_reason)));
 return jsonb_build_object('id',p_booking_id,'status','CANCELLED');
end $$;
