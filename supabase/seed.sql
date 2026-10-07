-- Development reference data only. Auth users must be created through Supabase Auth.
insert into public.organizations(code,name,organization_type) values ('NBU','North Bangkok University','UNIVERSITY') on conflict(code) do nothing;
insert into public.roles(code,name,description,system_role) values
 ('STUDENT','Student','Current student',true),('TEACHER','Teacher','Teaching staff',true),('STAFF','Staff','Administrative/operational staff',true)
on conflict(code) do update set name=excluded.name,description=excluded.description;
insert into public.permissions(code,description) values
 ('ROOM_MANAGE','Create and update rooms and equipment'),('SCHEDULE_MANAGE','Manage schedules and room blocks'),
 ('BOOKING_READ_ALL','Read all bookings'),('BOOKING_APPROVE','Approve or reject bookings'),('BOOKING_MANAGE','Manage any booking'),
 ('KEY_MANAGE','Manage key inventory and loans'),('USER_MANAGE','Manage application users and roles'),
 ('SETTINGS_MANAGE','Manage rules/settings'),('AUDIT_READ','Read audit history'),('REPORT_READ','Read operational reports')
on conflict(code) do update set description=excluded.description;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p where r.code='STAFF'
on conflict do nothing;

insert into public.room_types(code,name) values
 ('COMPUTER','Computer Room'),('STUDIO','Studio Room'),('GAMING','Gaming Room'),('ELEARNING','E-Learning Room'),('MEETING','Meeting Room'),('COLD','Cold Room')
on conflict(code) do nothing;
insert into public.rooms(code,name,room_type_id,building,floor,capacity,description)
select v.code,v.name,rt.id,'Main Building',v.floor,v.capacity,'Development seed room'
from (values ('COMP-101','Computer Room','COMPUTER','1',40),('STUDIO-201','Studio Room','STUDIO','2',25),
 ('GAME-301','Gaming Room','GAMING','3',30),('ELRN-202','E-Learning Room','ELEARNING','2',40),
 ('MEET-401','Faculty Meeting Room','MEETING','4',20),('COLD-102','Cold Room','COLD','1',15)) v(code,name,type_code,floor,capacity)
join public.room_types rt on rt.code=v.type_code on conflict(code) do nothing;
insert into public.equipment(code,name) values
 ('PROJECTOR','Projector'),('COMPUTER','Computer'),('MICROPHONE','Microphone'),('CAMERA','Camera'),('SMART_TV','Smart TV'),('WHITEBOARD','Whiteboard')
on conflict(code) do nothing;
insert into public.room_equipment(room_id,equipment_id,quantity)
select r.id,e.id,case when r.code='COMP-101' and e.code='COMPUTER' then 40 else 1 end
from public.rooms r join public.equipment e on
 (r.code='COMP-101' and e.code in ('COMPUTER','PROJECTOR','WHITEBOARD')) or
 (r.code='STUDIO-201' and e.code in ('CAMERA','MICROPHONE','SMART_TV')) or
 (r.code in ('ELRN-202','MEET-401') and e.code in ('PROJECTOR','WHITEBOARD'))
on conflict do nothing;
insert into public.room_keys(key_code,room_id)
select v.key_code,r.id from (values ('KEY-STUDIO-001','STUDIO-201'),('KEY-STUDIO-002','STUDIO-201'),('KEY-STUDIO-003','STUDIO-201'),('KEY-MEET-001','MEET-401')) v(key_code,room_code)
join public.rooms r on r.code=v.room_code on conflict(key_code) do nothing;
insert into public.booking_rules(rule_key,rule_value,description) values
 ('MAX_ADVANCE_BOOKING_DAYS','30','PROVISIONAL development default'),
 ('MAX_BOOKINGS_PER_DAY','3','PROVISIONAL development default'),
 ('ALLOW_WEEKEND_BOOKING','true','PROVISIONAL; Saturday is not hard-coded unavailable'),
 ('ALLOW_EXTERNAL_USERS','false','PROVISIONAL; external workflow not active'),
 ('AUTO_APPROVE_TEACHER_CLASS','false','PROVISIONAL pending policy confirmation'),
 ('CANCEL_BEFORE_MINUTES','60','PROVISIONAL development default'),
 ('KEY_RETURN_GRACE_MINUTES','15','PROVISIONAL development default'),
 ('BOOKING_DEFAULT_DURATION','60','PROVISIONAL duration in minutes'),
 ('HISTORY_RETENTION_DAYS','2555','PROVISIONAL development default')
on conflict(rule_key) do update set rule_value=excluded.rule_value,description=excluded.description;
insert into public.system_settings(setting_key,setting_value,description) values
 ('DISPLAY_TIMEZONE','"Asia/Bangkok"','Display timezone; persisted timestamps remain timestamptz')
on conflict(setting_key) do update set setting_value=excluded.setting_value;
