-- Users own their notification read state and report key lifecycle events themselves.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and user_id=v_actor;
end $$;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_count integer;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 update public.notifications set read_at=now() where user_id=v_actor and read_at is null;
 get diagnostics v_count=row_count;
 return v_count;
end $$;

revoke all on function public.mark_notification_read(uuid),public.mark_all_notifications_read() from public,anon;
grant execute on function public.mark_notification_read(uuid),public.mark_all_notifications_read() to authenticated;

alter table public.key_incidents alter column key_id drop not null;

create or replace function public.report_key_status(p_key_loan_id uuid,p_action text,p_description text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid();v_loan public.key_loans;v_action text:=upper(btrim(p_action));
 v_next public.key_loan_status;v_incident public.incident_type;v_incident_id uuid;v_now timestamptz:=now();
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if v_action not in ('CHECKED_OUT','RETURNED','LOST','DAMAGED') then raise exception 'INVALID_KEY_ACTION'; end if;
 select * into v_loan from public.key_loans where id=p_key_loan_id for update;
 if not found then raise exception 'KEY_LOAN_NOT_FOUND'; end if;
 if v_loan.borrower_id<>v_actor then raise exception 'FORBIDDEN' using errcode='42501'; end if;

 if v_action='CHECKED_OUT' then
  if v_loan.status<>'APPROVED' then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
  update public.key_loans set status='CHECKED_OUT',checked_out_at=v_now,checked_out_by=v_actor where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status='CHECKED_OUT' where id=v_loan.key_id and status in ('AVAILABLE','RESERVED'); end if;
  v_next:='CHECKED_OUT';
 elsif v_action='RETURNED' then
  if v_loan.status not in ('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
  update public.key_loans set status='RETURN_REPORTED',user_reported_return_at=v_now,return_confirmed_by=v_actor where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status='RESERVED' where id=v_loan.key_id; end if;
  v_next:='RETURN_REPORTED';
 else
  if v_loan.status not in ('CHECKED_OUT','LATE') then raise exception 'INVALID_KEY_LOAN_TRANSITION'; end if;
  if nullif(btrim(p_description),'') is null then raise exception 'ISSUE_DESCRIPTION_REQUIRED'; end if;
  v_next:=v_action::public.key_loan_status;v_incident:=v_action::public.incident_type;
  update public.key_loans set status=v_next,notes=btrim(p_description) where id=p_key_loan_id;
  if v_loan.key_id is not null then update public.room_keys set status=v_action::public.key_status where id=v_loan.key_id; end if;
  insert into public.key_incidents(key_id,key_loan_id,reported_by,responsible_user_id,incident_type,description)
  values(v_loan.key_id,p_key_loan_id,v_actor,v_actor,v_incident,btrim(p_description)) returning id into v_incident_id;
 end if;

 insert into public.key_loan_history(key_loan_id,previous_status,new_status,changed_by,notes)
 values(p_key_loan_id,v_loan.status,v_next,v_actor,coalesce(nullif(btrim(p_description),''),'User reported '||v_action));
 perform public.write_audit(v_actor,'KEY_STATUS_REPORTED','key_loan',p_key_loan_id,jsonb_build_object('action',v_action,'status',v_next,'incident_id',v_incident_id));
 return jsonb_build_object('id',p_key_loan_id,'status',v_next,'reported_at',v_now,'late',v_action='RETURNED' and v_loan.expected_return_at is not null and v_now>v_loan.expected_return_at);
end $$;

revoke all on function public.report_key_status(uuid,text,text) from public,anon;
grant execute on function public.report_key_status(uuid,text,text) to authenticated;

create or replace view public.admin_key_activity_v with (security_invoker=true) as
select l.*,k.key_code,r.code room_code,r.name room_name,
 (l.status='RETURN_REPORTED' and l.expected_return_at is not null and l.user_reported_return_at>l.expected_return_at) returned_late
from public.key_loans l left join public.room_keys k on k.id=l.key_id join public.rooms r on r.id=l.room_id;
grant select on public.admin_key_activity_v to authenticated;
