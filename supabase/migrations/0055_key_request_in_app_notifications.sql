-- Mirror authenticated key-request lifecycle changes into the in-app notification feed.
create or replace function public.notify_key_request_in_app()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_type text;v_title text;v_message text;v_notification_id uuid;
begin
 if new.authenticated_user_id is null then return new;end if;
 if tg_op='INSERT' then
  v_type:='KEY_REQUEST_SUBMITTED';v_title:='ส่งคำขอเบิกกุญแจแล้ว';v_message:='ระบบได้รับคำขอ '||new.request_code||' เรียบร้อยแล้ว';
 elsif old.status is not distinct from new.status then return new;
 else
  select x.type,x.title,x.message into v_type,v_title,v_message from(values
   ('APPROVED','KEY_REQUEST_APPROVED','อนุมัติคำขอเบิกกุญแจแล้ว','คำขอ '||new.request_code||' ได้รับการอนุมัติแล้ว'),
   ('REJECTED','KEY_REQUEST_REJECTED','ไม่อนุมัติคำขอเบิกกุญแจ','คำขอ '||new.request_code||' ไม่ได้รับการอนุมัติ'),
   ('CANCELLED','KEY_REQUEST_CANCELLED','ยกเลิกคำขอเบิกกุญแจแล้ว','คำขอ '||new.request_code||' ถูกยกเลิกแล้ว'),
   ('IN_USE','KEY_REQUEST_IN_USE','เริ่มใช้งานกุญแจแล้ว','คำขอ '||new.request_code||' อยู่ระหว่างใช้งาน'),
   ('RETURNED','KEY_REQUEST_RETURNED','คืนกุญแจเรียบร้อยแล้ว','ระบบบันทึกการคืนกุญแจของคำขอ '||new.request_code||' แล้ว')
  )x(status,type,title,message) where x.status=new.status;
  if v_type is null then return new;end if;
 end if;
 insert into public.notifications(user_id,type,title,message,related_entity_type,related_entity_id)
 values(new.authenticated_user_id,v_type,v_title,v_message,'key_request',new.id) returning id into v_notification_id;
 insert into public.notification_deliveries(notification_id,channel) values(v_notification_id,'IN_APP');
 return new;
end $$;

drop trigger if exists notify_key_request_in_app on public.key_requests;
create trigger notify_key_request_in_app after insert or update of status on public.key_requests
for each row execute function public.notify_key_request_in_app();
revoke all on function public.notify_key_request_in_app() from public,anon,authenticated;
