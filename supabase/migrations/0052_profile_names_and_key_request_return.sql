-- Preserve full names while exposing normalized first/last-name fields and a guarded self-service return RPC.
alter table public.profiles
 add column if not exists first_name text,
 add column if not exists last_name text;

alter table public.key_requests
 add column if not exists requester_first_name text,
 add column if not exists requester_last_name text;

update public.profiles
set first_name=nullif(split_part(btrim(full_name),' ',1),''),
 last_name=nullif(btrim(substr(btrim(full_name),length(split_part(btrim(full_name),' ',1))+1)),'')
where first_name is null;

update public.key_requests
set requester_first_name=nullif(split_part(btrim(requester_name),' ',1),''),
 requester_last_name=nullif(btrim(substr(btrim(requester_name),length(split_part(btrim(requester_name),' ',1))+1)),'')
where requester_first_name is null;

create or replace function public.sync_profile_name_parts()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' or new.full_name is distinct from old.full_name then
  new.first_name:=nullif(split_part(btrim(new.full_name),' ',1),'');
  new.last_name:=nullif(btrim(substr(btrim(new.full_name),length(split_part(btrim(new.full_name),' ',1))+1)),'');
 end if;
 return new;
end $$;

drop trigger if exists sync_profile_name_parts on public.profiles;
create trigger sync_profile_name_parts before insert or update of full_name on public.profiles
for each row execute function public.sync_profile_name_parts();

create or replace function public.sync_key_request_name_parts()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' or new.requester_name is distinct from old.requester_name then
  new.requester_first_name:=nullif(split_part(btrim(new.requester_name),' ',1),'');
  new.requester_last_name:=nullif(btrim(substr(btrim(new.requester_name),length(split_part(btrim(new.requester_name),' ',1))+1)),'');
 end if;
 return new;
end $$;

drop trigger if exists sync_key_request_name_parts on public.key_requests;
create trigger sync_key_request_name_parts before insert or update of requester_name on public.key_requests
for each row execute function public.sync_key_request_name_parts();

drop function if exists public.get_my_key_requests();
create function public.get_my_key_requests()
returns table(id uuid,request_code text,room_code text,room_name text,room_type_name text,floor text,starts_at timestamptz,ends_at timestamptz,purpose text,purpose_type text,course_code text,lecturer_name text,status text,can_cancel boolean,can_return boolean)
language plpgsql security definer set search_path='' stable as $$
declare v_email text;
begin
 select lower(u.email) into v_email from auth.users u
 where u.id=auth.uid() and u.email_confirmed_at is not null;
 if v_email is null then return;end if;
 return query
 select k.id,k.request_code,r.code,r.name,rt.name,r.floor,k.starts_at,k.ends_at,k.purpose,k.purpose_type,k.course_code,k.lecturer_name,k.status,
  (k.status in('PENDING_APPROVAL','APPROVED') and k.ends_at>now()) as can_cancel,
  (k.status in('APPROVED','IN_USE') and now()>=k.starts_at) as can_return
 from public.key_requests k
 join public.rooms r on r.id=k.room_id
 join public.room_types rt on rt.id=r.room_type_id
 where k.authenticated_user_id=auth.uid()
  or (k.authenticated_user_id is null and lower(k.requester_email)=lower(v_email))
 order by k.created_at desc;
end $$;

create or replace function public.return_my_key_request(p_key_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_email text;v_request public.key_requests;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='28000';end if;
 select lower(u.email) into v_email from auth.users u where u.id=v_actor and u.email_confirmed_at is not null;
 select * into v_request from public.key_requests where id=p_key_request_id for update;
 if not found or not(v_request.authenticated_user_id=v_actor or (v_request.authenticated_user_id is null and v_email is not null and lower(v_request.requester_email)=lower(v_email))) then
  raise exception 'KEY_REQUEST_NOT_FOUND' using errcode='42501';
 end if;
 if v_request.status not in('APPROVED','IN_USE') then raise exception 'KEY_REQUEST_NOT_RETURNABLE';end if;
 if now()<v_request.starts_at then raise exception 'KEY_REQUEST_NOT_STARTED';end if;
 perform set_config('app.key_request_actor_kind','USER',true);
 update public.key_requests set status='RETURNED',returned_at=now() where id=v_request.id returning * into v_request;
 perform public.write_audit(v_actor,'KEY_REQUEST_RETURNED','key_request',v_request.id,jsonb_build_object('source','SELF_SERVICE'));
 return jsonb_build_object('id',v_request.id,'status',v_request.status,'returned_at',v_request.returned_at);
end $$;

create or replace function public.get_public_key_request_history(p_room_id uuid,p_limit integer default 10)
returns table(id uuid,requester_name text,starts_at timestamptz,ends_at timestamptz,status text)
language sql security definer set search_path='' stable as $$
 select r.id,
  (case r.requester_type when 'TEACHER' then 'อ. ' when 'STUDENT' then 'นศ. ' else '' end)||coalesce(r.requester_first_name,r.requester_name)||case when nullif(trim(r.purpose),'') is not null then ' · '||trim(r.purpose) else '' end,
  r.starts_at,r.ends_at,r.status
 from public.key_requests r
 where r.room_id=p_room_id and r.status in('PENDING_APPROVAL','APPROVED','IN_USE','RETURNED')
  and (r.starts_at at time zone 'Asia/Bangkok')::date<=(now() at time zone 'Asia/Bangkok')::date
 order by r.starts_at desc limit least(greatest(coalesce(p_limit,10),1),10)
$$;

create or replace function public.get_public_room_schedule_events(p_room_id uuid,p_range_start date,p_range_end date)
returns table(id text,event_type text,title text,starts_at timestamptz,ends_at timestamptz,source_id uuid,source_type text,status text,is_mine boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_can_view boolean;
begin
 if p_range_end<p_range_start or p_range_end-p_range_start>62 then raise exception 'INVALID_DATE_RANGE';end if;
 if not exists(select 1 from public.rooms r where r.id=p_room_id and r.active) then raise exception 'ROOM_NOT_FOUND';end if;
 select case when auth.uid() is null then coalesce(p.guest_view_schedule,true) when public.has_role('STUDENT') then coalesce(p.student_view_schedule,true) else true end into v_can_view from public.rooms r left join public.room_usage_policies p on p.room_id=r.id where r.id=p_room_id;
 if not coalesce(v_can_view,false) then raise exception 'SCHEDULE_POLICY_DENIED' using errcode='42501';end if;
 return query with occurrences as (
  select s.*,day::date occurrence_date from public.class_schedules s cross join lateral generate_series(greatest(s.effective_from,p_range_start),least(s.effective_until,p_range_end),interval '1 day') day
  where s.room_id=p_room_id and s.active and s.status='ACTIVE' and extract(dow from day)::smallint=s.day_of_week
 ),events as (
  select 'class:'||s.id||':'||s.occurrence_date,'CLASS'::text,coalesce(s.course_code||' · '||s.subject_name,'ตารางเรียน'),(s.occurrence_date+s.start_time) at time zone 'Asia/Bangkok',(s.occurrence_date+s.end_time) at time zone 'Asia/Bangkok',null::uuid,'CLASS_SCHEDULE'::text,'ACTIVE'::text,false from occurrences s
  union all select 'booking:'||md5(b.id::text),'BOOKING','มีการจองห้อง',b.starts_at,b.ends_at,null::uuid,'BOOKING',b.status::text,(auth.uid() is not null and (b.requester_id=auth.uid() or b.beneficiary_user_id=auth.uid())) from public.bookings b where b.room_id=p_room_id and b.status in('PENDING','APPROVED','IN_USE') and b.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and b.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'key-request:'||md5(r.id::text),'BOOKING',(case r.requester_type when 'TEACHER' then 'อ. ' when 'STUDENT' then 'นศ. ' else '' end)||coalesce(r.requester_first_name,r.requester_name)||case when nullif(trim(r.purpose),'') is not null then ' · '||trim(r.purpose) else '' end,r.starts_at,r.ends_at,null::uuid,'KEY_REQUEST',r.status,false from public.key_requests r where r.room_id=p_room_id and r.status in('PENDING_APPROVAL','APPROVED','IN_USE') and r.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and r.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
  union all select 'block:'||md5(rb.id::text),'BLOCK','ห้องไม่พร้อมใช้งาน',rb.starts_at,rb.ends_at,null::uuid,'ROOM_BLOCK','ACTIVE',false from public.room_blocks rb where rb.room_id=p_room_id and rb.starts_at<((p_range_end+1)::timestamp at time zone 'Asia/Bangkok') and rb.ends_at>(p_range_start::timestamp at time zone 'Asia/Bangkok')
 ) select * from events order by 4;
end $$;

revoke all on function public.get_my_key_requests() from public;
revoke all on function public.return_my_key_request(uuid) from public;
revoke all on function public.get_public_key_request_history(uuid,integer) from public;
revoke all on function public.get_public_room_schedule_events(uuid,date,date) from public;
grant execute on function public.get_my_key_requests() to authenticated;
grant execute on function public.return_my_key_request(uuid) to authenticated;
grant execute on function public.get_public_key_request_history(uuid,integer) to anon,authenticated;
grant execute on function public.get_public_room_schedule_events(uuid,date,date) to anon,authenticated;
