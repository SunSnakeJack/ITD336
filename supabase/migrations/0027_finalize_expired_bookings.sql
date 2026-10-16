-- Reconcile elapsed bookings without guessing whether the room was actually used.
create or replace function public.reconcile_expired_bookings()
returns integer language plpgsql security definer set search_path='' as $$
declare v_booking public.bookings;v_count integer:=0;
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 for v_booking in select * from public.bookings where status in('APPROVED','IN_USE') and ends_at<=now() for update skip locked loop
  update public.bookings set status='COMPLETED',updated_at=now() where id=v_booking.id;
  insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason)
  values(v_booking.id,v_booking.status,'COMPLETED',null,'Booking end time elapsed');
  perform public.write_audit(null,'BOOKING_AUTO_COMPLETED','booking',v_booking.id,jsonb_build_object('previous_status',v_booking.status,'ends_at',v_booking.ends_at));
  v_count:=v_count+1;
 end loop;
 return v_count;
end $$;

create or replace function public.cancel_booking(p_booking_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_booking public.bookings;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 if nullif(btrim(p_reason),'') is null then raise exception 'CANCELLATION_REASON_REQUIRED';end if;
 select * into v_booking from public.bookings where id=p_booking_id for update;
 if not found then raise exception 'BOOKING_NOT_FOUND';end if;
 if v_booking.requester_id<>v_actor and not public.has_permission('BOOKING_MANAGE') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if v_booking.ends_at<=now() then raise exception 'BOOKING_ALREADY_ENDED' using errcode='22023';end if;
 if v_booking.status not in('PENDING','APPROVED') then raise exception 'INVALID_BOOKING_TRANSITION';end if;
 update public.bookings set status='CANCELLED',cancelled_at=now(),cancelled_by=v_actor,cancel_reason=btrim(p_reason) where id=p_booking_id;
 insert into public.booking_status_history(booking_id,previous_status,new_status,changed_by,reason) values(p_booking_id,v_booking.status,'CANCELLED',v_actor,btrim(p_reason));
 perform public.create_notification(v_booking.requester_id,'BOOKING_CANCELLED','Booking cancelled','Booking '||v_booking.booking_code||' was cancelled.','booking',p_booking_id);
 perform public.write_audit(v_actor,'BOOKING_CANCELLED','booking',p_booking_id,jsonb_build_object('reason',btrim(p_reason)));
 return jsonb_build_object('id',p_booking_id,'status','CANCELLED');
end $$;

revoke all on function public.reconcile_expired_bookings(),public.cancel_booking(uuid,text) from public,anon;
grant execute on function public.reconcile_expired_bookings(),public.cancel_booking(uuid,text) to authenticated;
