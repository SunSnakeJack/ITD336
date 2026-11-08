-- Idempotent display data for the mobile key-request journey.
-- Existing room UUIDs and operational history are preserved.
insert into public.equipment(code,name,description) values
 ('MICROPHONE','ไมโครโฟน','อุปกรณ์ขยายเสียงประจำห้อง'),('SPEAKER','ลำโพง','ระบบเสียงประจำห้อง'),
 ('WHITEBOARD','กระดานไวท์บอร์ด','กระดานสำหรับการเรียนการสอน'),('COMPUTER','คอมพิวเตอร์','เครื่องคอมพิวเตอร์สำหรับผู้ใช้งาน')
on conflict(code) do update set name=excluded.name,description=excluded.description;

with catalog(code,name,type_code,capacity,description,location_description) as (values
 ('S2407','ห้องปฏิบัติการ S2407','COMPUTER',30,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2408','ห้องปฏิบัติการ S2408','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2409','ห้องปฏิบัติการ S2409','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2410','ห้องปฏิบัติการ S2410','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2411','ห้องปฏิบัติการ S2411','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('S2412','ห้องปฏิบัติการ S2412','COMPUTER',40,'ห้องปฏิบัติการคอมพิวเตอร์สำหรับการเรียนการสอน','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4'),
 ('STUDIO','Studio','STUDIO',20,'ห้องผลิตสื่อและบันทึกภาพ','ชั้นลอย ใกล้บันได'),
 ('ESPORT','E-Sport','GAMING',30,'ห้องปฏิบัติการกีฬาอิเล็กทรอนิกส์','ชั้นลอย ใกล้บันได'),
 ('ELEARNING','ห้องผลิตสื่อ e-learning','ELEARNING',20,'ห้องผลิตสื่อการเรียนรู้ออนไลน์','อาคารคณะเทคโนโลยีสารสนเทศ ชั้น 4')
)
insert into public.rooms(code,layout_key,name,room_type_id,building,floor,location_description,capacity,description,booking_enabled,active)
select c.code,c.code,c.name,t.id,'อาคารคณะเทคโนโลยีสารสนเทศ',case when c.code in('STUDIO','ESPORT') then 'ชั้นลอย' else '4' end,c.location_description,c.capacity,c.description,true,true
from catalog c join public.room_types t on t.code=c.type_code
on conflict(code) do update set name=excluded.name,room_type_id=excluded.room_type_id,building=excluded.building,floor=excluded.floor,location_description=excluded.location_description,capacity=excluded.capacity,description=excluded.description;

insert into public.room_equipment(room_id,equipment_id,quantity)
select r.id,e.id,case when e.code='COMPUTER' then greatest(r.capacity,1) else 1 end
from public.rooms r cross join public.equipment e
where r.code in('S2407','S2408','S2409','S2410','S2411','S2412','STUDIO','ESPORT','ELEARNING')
  and e.code in('MICROPHONE','SPEAKER','WHITEBOARD','COMPUTER')
on conflict(room_id,equipment_id) do update set quantity=excluded.quantity;

update public.rooms set key_approval_mode='AUTO' where code in('S2407','S2408','S2409','S2410','S2411','S2412');
update public.rooms set key_approval_mode='ADMIN' where code in('STUDIO','ESPORT','ELEARNING');
