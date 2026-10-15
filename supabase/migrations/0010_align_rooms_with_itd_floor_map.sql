-- Align the room catalog with the approved ITD floor-map labels while preserving
-- the six existing room UUIDs and every booking/schedule/key relationship.

update public.rooms set code='S2407',name='ห้องปฏิบัติการ S2407',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4',location_description='ฝั่งห้องปฏิบัติการ ชั้น 4' where code='COLD-102';
update public.rooms set code='S2408',name='ห้องปฏิบัติการ S2408',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4',location_description='ฝั่งห้องปฏิบัติการ ชั้น 4' where code='COMP-101';
update public.rooms set code='STUDIO',name='Studio',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4.5',location_description='ชั้นลอย ใกล้บันได' where code='STUDIO-201';
update public.rooms set code='ESPORT',name='E-sport',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='3.5',location_description='ชั้นลอย ใกล้บันได' where code='GAME-301';
update public.rooms set code='ELEARNING',name='E-learning',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4',location_description='ใกล้บันได ชั้น 4' where code='ELRN-202';
update public.rooms set code='MEET-FACULTY',name='ห้องประชุมคณะ',building='อาคารคณะเทคโนโลยีสารสนเทศ',floor='4',location_description='ภายในพื้นที่สำนักงานคณะ' where code='MEET-401';

insert into public.rooms(code,name,room_type_id,building,floor,location_description,capacity,description)
select v.code,'ห้องปฏิบัติการ '||v.code,rt.id,'อาคารคณะเทคโนโลยีสารสนเทศ','4','ฝั่งห้องปฏิบัติการ ชั้น 4',40,'ห้องปฏิบัติการคอมพิวเตอร์'
from (values ('S2409'),('S2410'),('S2411'),('S2412')) v(code)
join public.room_types rt on rt.code='COMPUTER'
where not exists(select 1 from public.rooms r where r.code=v.code);
