alter table public.key_requests add column staff_verified_room_return boolean not null default false;
alter table public.key_loans add column staff_verified_room_return boolean not null default false;

create or replace function public.append_key_request_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.key_request_status_history(key_request_id,new_status,actor_user_id,actor_kind,reason)
  values(new.id,new.status,new.authenticated_user_id,case when new.authenticated_user_id is null then 'ANONYMOUS' else 'USER' end,'Request submitted');
 elsif new.status is distinct from old.status then
  insert into public.key_request_status_history(key_request_id,previous_status,new_status,actor_user_id,actor_kind,reason)
  values(new.id,old.status,new.status,
   case when new.staff_verified_room_return and not old.staff_verified_room_return then auth.uid() else coalesce(new.decided_by,new.authenticated_user_id) end,
   case when new.staff_verified_room_return and not old.staff_verified_room_return then 'ADMIN' else
    coalesce(nullif(current_setting('app.key_request_actor_kind',true),''),
     case when new.decided_by is not null then 'ADMIN' when new.authenticated_user_id is not null then 'USER' else 'SYSTEM' end) end,
   case when new.staff_verified_room_return and not old.staff_verified_room_return then 'Staff confirmed physical return'
    else coalesce(new.decision_reason,'Status changed') end);
 end if;
 return new;
end $$;

create function public.staff_confirm_overdue_key_returns(p_room_id uuid, p_expected_count integer)
returns integer language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid();
 v_now timestamptz := statement_timestamp();
 v_request_id uuid;
 v_loan public.key_loans;
 v_count integer := 0;
begin
 if v_actor is null or not public.has_permission('KEY_MANAGE') then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 if p_room_id is null or p_expected_count < 1 then
  raise exception 'INVALID_RETURN_CONFIRMATION' using errcode='22023';
 end if;

 perform pg_advisory_xact_lock(hashtextextended(p_room_id::text, 101));
 for v_request_id in
  select id from public.key_requests
  where room_id=p_room_id and status in ('APPROVED','IN_USE') and returned_at is null and ends_at<v_now
  order by id for update
 loop
  v_count := v_count + 1;
  continue when p_expected_count is null;
  update public.key_requests
  set status='RETURNED', returned_at=v_now, staff_verified_room_return=true
  where id=v_request_id;
  perform public.write_audit(v_actor,'KEY_REQUEST_RETURNED','key_request',v_request_id,
   jsonb_build_object('source','STAFF_ROOM_RETURN','room_id',p_room_id,'returned_at',v_now));
 end loop;

 -- Legacy dashboard loans obtain their scheduled deadline from the linked booking.
 for v_loan in
  select kl.* from public.key_loans kl join public.bookings b on b.id=kl.booking_id
  where kl.room_id=p_room_id and b.room_id=p_room_id and b.ends_at<v_now
   and kl.status in ('CHECKED_OUT','LATE') and kl.returned_at is null
  order by kl.id for update of kl
 loop
  v_count := v_count + 1;
  continue when p_expected_count is null;
  update public.key_loans
  set status='RETURNED', returned_at=v_now, returned_to=v_actor,
   physically_verified_at=v_now, physically_verified_by=v_actor, staff_verified_room_return=true
  where id=v_loan.id;
  update public.room_keys set status='AVAILABLE', updated_at=v_now
  where id=v_loan.key_id and status in ('CHECKED_OUT','RESERVED');
  insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
  values(v_loan.id,v_loan.status,'RETURNED',v_actor,'Staff confirmed receipt from the usage dashboard');
  perform public.create_notification(v_loan.borrower_id,'KEY_RETURN_VERIFIED','ยืนยันการคืนกุญแจแล้ว',
   'เจ้าหน้าที่บันทึกว่าได้รับกุญแจคืนแล้ว','key_loan',v_loan.id);
  perform public.write_audit(v_actor,'KEY_RETURN_VERIFIED','key_loan',v_loan.id,
   jsonb_build_object('source','STAFF_ROOM_RETURN','room_id',p_room_id,'returned_at',v_now));
 end loop;

 if p_expected_count is not null and v_count > 0 and v_count <> p_expected_count then
  raise exception 'OVERDUE_RETURN_SET_CHANGED';
 end if;
 return v_count;
end $$;

revoke all on function public.staff_confirm_overdue_key_returns(uuid,integer) from public,anon,authenticated;
grant execute on function public.staff_confirm_overdue_key_returns(uuid,integer) to authenticated;

create or replace function public.get_staff_usage_history()
returns table(transaction_id text,source text,room_id uuid,room_code text,room_name text,room_category text,purpose text,user_name text,starts_at timestamptz,ends_at timestamptz,returned_at timestamptz,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not(public.has_permission('REPORT_READ') or public.has_permission('ROOM_MANAGE')) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return query with usage_rows(
  transaction_id,source,room_id,room_code,room_name,room_category,purpose,user_name,starts_at,ends_at,returned_at,status
 ) as (
  select 'booking:'||b.id::text,'BOOKING'::text,r.id,r.code,r.name,'MEETING'::text,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),b.starts_at,b.ends_at,null::timestamptz,b.status::text
  from public.bookings b join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=b.requester_id where rt.usage_scope='MEETING' and b.status in('PENDING','APPROVED','IN_USE','COMPLETED')
  union all
  select 'key-request:'||k.id::text,'KEY_REQUEST',r.id,r.code,r.name,rt.report_category,case when k.status='REJECTED' then coalesce(k.decision_reason,k.purpose) else k.purpose end,coalesce(nullif(k.requester_name,''),p.full_name,k.requester_email,'ไม่ระบุ'),k.starts_at,k.ends_at,k.returned_at,
   case when k.staff_verified_room_return and k.status='RETURNED' then 'RETURNED_VERIFIED' else k.status end
  from public.key_requests k join public.rooms r on r.id=k.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=k.authenticated_user_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and k.status in('PENDING_APPROVAL','APPROVED','REJECTED','IN_USE','RETURNED')
  union all
  select 'key-loan:'||kl.id::text,'KEY_LOAN',r.id,r.code,r.name,rt.report_category,b.purpose,coalesce(nullif(p.full_name,''),p.email,'ไม่ระบุ'),coalesce(kl.checked_out_at,b.starts_at),b.ends_at,kl.returned_at,
   case when kl.staff_verified_room_return and kl.status='RETURNED' then 'RETURNED_VERIFIED' else kl.status::text end
  from public.key_loans kl join public.bookings b on b.id=kl.booking_id join public.rooms r on r.id=b.room_id join public.room_types rt on rt.id=r.room_type_id left join public.profiles p on p.id=kl.borrower_id where rt.report_category in('GENERAL_LAB','SPECIAL_LAB') and kl.status in('CHECKED_OUT','RETURNED','LATE','LOST','DAMAGED')
 ) select u.* from usage_rows u order by u.starts_at desc,u.transaction_id;
end $$;
