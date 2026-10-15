-- Development reference data only. Auth users must be created through Supabase Auth.
insert into public.organizations(code,name,organization_type) values ('NBU','North Bangkok University','UNIVERSITY') on conflict(code) do nothing;
insert into public.roles(code,name,description,system_role) values
 ('STUDENT','Student','Current student',true),('TEACHER','Teacher','Teaching staff',true),
 ('STAFF','Staff','Read-only building and housekeeping personnel',true),
 ('ADMIN','Administrator','Administrative management role',true),
 ('PRIORITY_USER','Priority User','Booking override authority without Admin access',true)
on conflict(code) do update set name=excluded.name,description=excluded.description;
insert into public.permissions(code,description) values
 ('ROOM_MANAGE','Create and update rooms and equipment'),('SCHEDULE_MANAGE','Manage schedules and room blocks'),
 ('BOOKING_READ_ALL','Read all bookings'),('BOOKING_APPROVE','Approve or reject bookings'),('BOOKING_MANAGE','Manage any booking'),
 ('KEY_MANAGE','Manage key inventory and loans'),('USER_MANAGE','Manage application users and roles'),
 ('SETTINGS_MANAGE','Manage rules/settings'),('AUDIT_READ','Read audit history'),('REPORT_READ','Read operational reports'),
 ('ROOM_READ_ALL','Read room operational data'),('SCHEDULE_READ_ALL','Read operational schedules'),
 ('OCCUPANCY_READ','Read sanitized occupancy summaries'),('BOOKING_OVERRIDE','Transactionally supersede an ordinary booking'),
 ('KEY_DIRECT_USE','Borrow a tracked key for authorized direct usage'),
 ('BOOKING_CREATE_FOR_OTHERS','Create a booking for another or external person')
on conflict(code) do update set description=excluded.description;
delete from public.role_permissions rp using public.roles r where rp.role_id=r.id and r.code='STAFF';
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.code in ('ROOM_READ_ALL','SCHEDULE_READ_ALL','OCCUPANCY_READ','REPORT_READ')
where r.code='STAFF' on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code='ADMIN'
on conflict do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r join public.permissions p on p.code='BOOKING_OVERRIDE'
where r.code='PRIORITY_USER' on conflict do nothing;

insert into public.room_types(code,name,booking_policy,student_booking_allowed) values
 ('COMPUTER','Computer Room','AUTO_CONFIRM',true),('STUDIO','Studio Room','MANUAL_APPROVAL',true),
 ('GAMING','Gaming Room','MANUAL_APPROVAL',true),('ELEARNING','E-Learning Room','MANUAL_APPROVAL',true),
 ('MEETING','Meeting Room','AUTO_CONFIRM',true),('COLD','Cold Room','AUTO_CONFIRM',false),
 ('CLASSROOM','Classroom','MANUAL_APPROVAL',true)
on conflict(code) do update set booking_policy=excluded.booking_policy,student_booking_allowed=excluded.student_booking_allowed;
insert into public.rooms(code,name,room_type_id,building,floor,capacity,description)
select v.code,v.name,rt.id,'อาคารคณะเทคโนโลยีสารสนเทศ',v.floor,v.capacity,'Development seed room aligned with the ITD floor map'
from (values ('S2407','ห้องปฏิบัติการ S2407','COMPUTER','4',40),('S2408','ห้องปฏิบัติการ S2408','COMPUTER','4',40),
 ('S2409','ห้องปฏิบัติการ S2409','COMPUTER','4',40),('S2410','ห้องปฏิบัติการ S2410','COMPUTER','4',40),
 ('S2411','ห้องปฏิบัติการ S2411','COMPUTER','4',40),('S2412','ห้องปฏิบัติการ S2412','COMPUTER','4',40),
 ('STUDIO','Studio','STUDIO','4.5',25),('ESPORT','E-sport','GAMING','3.5',30),
 ('ELEARNING','E-learning','ELEARNING','4',40),('MEET-FACULTY','ห้องประชุมคณะ','MEETING','4',20),
 ('2401','ห้องเรียน 2401','CLASSROOM','4',40),('2402','ห้องเรียน 2402','CLASSROOM','4',40),
 ('2403','ห้องเรียน 2403','CLASSROOM','4',40),('2404','ห้องเรียน 2404','CLASSROOM','4',40),
 ('2405','ห้องเรียน 2405','CLASSROOM','4',40),('2406','ห้องเรียน 2406','CLASSROOM','4',40)) v(code,name,type_code,floor,capacity)
join public.room_types rt on rt.code=v.type_code on conflict(code) do nothing;
insert into public.equipment(code,name) values
 ('PROJECTOR','Projector'),('COMPUTER','Computer'),('MICROPHONE','Microphone'),('CAMERA','Camera'),('SMART_TV','Smart TV'),('WHITEBOARD','Whiteboard')
on conflict(code) do nothing;
insert into public.room_equipment(room_id,equipment_id,quantity)
select r.id,e.id,case when r.code like 'S24%' and e.code='COMPUTER' then 40 else 1 end
from public.rooms r join public.equipment e on
 (r.code like 'S24%' and e.code in ('COMPUTER','PROJECTOR','WHITEBOARD')) or
 (r.code='STUDIO' and e.code in ('CAMERA','MICROPHONE','SMART_TV')) or
 (r.code in ('ELEARNING','MEET-FACULTY') and e.code in ('PROJECTOR','WHITEBOARD'))
on conflict do nothing;
insert into public.room_keys(key_code,room_id)
select v.key_code,r.id from (values ('KEY-STUDIO-001','STUDIO'),('KEY-STUDIO-002','STUDIO'),('KEY-STUDIO-003','STUDIO'),('KEY-MEET-001','MEET-FACULTY')) v(key_code,room_code)
join public.rooms r on r.code=v.room_code on conflict(key_code) do nothing;
insert into public.booking_rules(rule_key,rule_value,description) values
 ('MAX_ADVANCE_BOOKING_DAYS','3','Confirmed V2 limit; implemented as rolling exact duration pending calendar-day confirmation'),
 ('MAX_BOOKINGS_PER_DAY','3','PROVISIONAL development default'),
 ('ALLOW_WEEKEND_BOOKING','true','PROVISIONAL for Sunday; Saturday is closed through CLOSED_WEEKDAYS'),
 ('CLOSED_WEEKDAYS','[6]','Confirmed weekly closure; PostgreSQL day 6 is Saturday'),
 ('ALLOW_EXTERNAL_USERS','false','PROVISIONAL; external workflow not active'),
 ('AUTO_APPROVE_TEACHER_CLASS','false','PROVISIONAL pending policy confirmation'),
 ('CANCEL_BEFORE_MINUTES','60','PROVISIONAL development default'),
 ('KEY_RETURN_GRACE_MINUTES','15','PROVISIONAL development default'),
 ('BOOKING_DEFAULT_DURATION','60','PROVISIONAL duration in minutes'),
 ('HISTORY_RETENTION_DAYS','2555','PROVISIONAL development default'),
 ('GENERAL_OPEN_TIME','"08:30"','Confirmed V2 local opening time in Asia/Bangkok'),
 ('GENERAL_CLOSE_TIME','"17:30"','Confirmed V2 local closing time in Asia/Bangkok'),
 ('ADVANCE_BOOKING_INTERPRETATION','"EXACT_DURATION"','PENDING_BUSINESS_DECISION: confirm calendar days vs exact duration')
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description;
insert into public.system_settings(setting_key,setting_value,description) values
 ('DISPLAY_TIMEZONE','"Asia/Bangkok"','Display timezone; persisted timestamps remain timestamptz')
on conflict(setting_key) do update set setting_value=excluded.setting_value;

-- Local/demo accounts only. Never run this seed file against a production project.
-- The shared password is intentionally limited to these non-production demonstration users.
insert into auth.users (
 instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,
 confirmation_token,email_change,email_change_token_new,recovery_token
) values
 ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000001','authenticated','authenticated','student@itd336.local',extensions.crypt('123456',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"นักศึกษาทดลอง"}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000002','authenticated','authenticated','teacher@itd336.local',extensions.crypt('123456',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"อาจารย์ทดลอง"}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000003','authenticated','authenticated','staff@itd336.local',extensions.crypt('123456',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"เจ้าหน้าที่ทดลอง"}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000004','authenticated','authenticated','admin@itd336.local',extensions.crypt('123456',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"ผู้ดูแลระบบทดลอง"}',now(),now(),'','','',''),
 ('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000005','authenticated','authenticated','priority@itd336.local',extensions.crypt('123456',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"ผู้ใช้สิทธิ์พิเศษทดลอง"}',now(),now(),'','','','')
on conflict(id) do update set
 email=excluded.email,
 encrypted_password=excluded.encrypted_password,
 email_confirmed_at=excluded.email_confirmed_at,
 raw_app_meta_data=excluded.raw_app_meta_data,
 raw_user_meta_data=excluded.raw_user_meta_data,
 updated_at=now();

insert into auth.identities (
 id,user_id,provider_id,identity_data,provider,last_sign_in_at,created_at,updated_at
)
select
 u.id,u.id,u.id::text,
 jsonb_build_object('sub',u.id::text,'email',u.email,'email_verified',true),
 'email',now(),now(),now()
from auth.users u
where u.id in (
 '10000000-0000-0000-0000-000000000001',
 '10000000-0000-0000-0000-000000000002',
 '10000000-0000-0000-0000-000000000003',
 '10000000-0000-0000-0000-000000000004',
 '10000000-0000-0000-0000-000000000005'
)
on conflict(id) do update set identity_data=excluded.identity_data,updated_at=now();

insert into public.user_roles(user_id,role_id)
select mapping.user_id,r.id
from (values
 ('10000000-0000-0000-0000-000000000001'::uuid,'STUDENT'),
 ('10000000-0000-0000-0000-000000000002'::uuid,'TEACHER'),
 ('10000000-0000-0000-0000-000000000003'::uuid,'STAFF'),
 ('10000000-0000-0000-0000-000000000004'::uuid,'ADMIN'),
 ('10000000-0000-0000-0000-000000000005'::uuid,'PRIORITY_USER')
) mapping(user_id,role_code)
join public.roles r on r.code=mapping.role_code
on conflict(user_id,role_id) do nothing;
