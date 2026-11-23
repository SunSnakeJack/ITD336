-- Scheduled in-app reminders are independent of email delivery.
create unique index notifications_room_reminder_once
 on public.notifications(user_id, type, related_entity_type, related_entity_id)
 where type in ('BOOKING_STARTING_SOON', 'BOOKING_START_TIME',
                'KEY_REQUEST_STARTING_SOON', 'KEY_REQUEST_START_TIME', 'KEY_REQUEST_ENDING_SOON');

create function public.publish_room_reminders()
returns void language sql set search_path='' as $$
 with candidates as (
  select b.requester_id as user_id, b.id, b.starts_at, b.ends_at,
         'booking'::text as entity, b.booking_code as code
  from public.bookings b
  where b.status in ('APPROVED', 'IN_USE')
    and b.starts_at > now() - interval '5 minutes'
    and b.starts_at <= now() + interval '30 minutes'
    and b.ends_at > now()
  union all
  select coalesce(k.authenticated_user_id, u.id), k.id, k.starts_at, k.ends_at,
         'key_request', k.request_code
  from public.key_requests k
  left join auth.users u on k.authenticated_user_id is null
   and lower(u.email) = lower(k.requester_email) and u.email_confirmed_at is not null
  where k.status in ('APPROVED', 'IN_USE') and k.ends_at > now()
    and (k.starts_at between now() - interval '5 minutes' and now() + interval '30 minutes'
         or k.ends_at <= now() + interval '30 minutes')
 ), reminders as (
  select c.user_id, c.entity, c.id, c.code, e.type, e.title
  from candidates c
  join public.profiles p on p.id = c.user_id
  cross join lateral (values
   (upper(c.entity) || '_STARTING_SOON', 'ใกล้ถึงเวลาใช้ห้อง',
    c.starts_at > now() and c.starts_at <= now() + interval '30 minutes'),
   (upper(c.entity) || '_START_TIME', 'ถึงเวลาใช้ห้องแล้ว',
    c.starts_at <= now() and c.starts_at > now() - interval '5 minutes'),
   ('KEY_REQUEST_ENDING_SOON', 'ใกล้ถึงกำหนดคืนกุญแจ',
    c.entity = 'key_request' and c.starts_at <= now() and c.ends_at <= now() + interval '30 minutes')
  ) e(type, title, due)
  where e.due
 ), inserted as (
  insert into public.notifications(user_id, type, title, message, related_entity_type, related_entity_id)
  select user_id, type, title, title || ' · ' || code, entity, id from reminders
  on conflict (user_id, type, related_entity_type, related_entity_id)
   where type in ('BOOKING_STARTING_SOON', 'BOOKING_START_TIME',
                  'KEY_REQUEST_STARTING_SOON', 'KEY_REQUEST_START_TIME', 'KEY_REQUEST_ENDING_SOON')
   do nothing
  returning id
 )
 insert into public.notification_deliveries(notification_id, channel)
 select id, 'IN_APP' from inserted;
$$;

revoke all on function public.publish_room_reminders() from public, anon, authenticated;

select cron.schedule('itd336-room-reminders', '* * * * *', 'select public.publish_room_reminders()');
