# ITD336 Supabase Database Overview

> เอกสารอ้างอิงสำหรับนักพัฒนาเท่านั้น ไม่ใช่ migration, rebuild script หรือไฟล์สำหรับ deploy ฐานข้อมูล แหล่งความจริงของ schema ยังคงเป็นไฟล์ใน `supabase/migrations/`

## 1. Database Overview

ฐานข้อมูลรองรับระบบจองห้อง ตารางเรียน การเบิก–คืนกุญแจ การแจ้งเตือน รายงาน และ RBAC บน Supabase PostgreSQL การวิเคราะห์นี้สร้างจาก migration `0001`–`0027` แบบ static เท่านั้น ไม่ได้เชื่อมต่อฐานข้อมูล local/remote และไม่ยืนยันข้อมูล runtime

สถานะที่สร้างใหม่ใน migration ภายหลังจะทับความหมายของ definition ชื่อเดียวกันจาก migration ก่อนหน้า เช่น `create_booking`, `check_room_availability`, `request_booking_key`, `report_key_status` และ `get_admin_key_cabinet`

## 2. Database Architecture

- Identity: `auth.users` → `public.profiles` → `user_roles` → `roles`/`permissions`
- Room and academic: `room_types`, `rooms`, `class_schedules`, `academic_terms`, `room_blocks`, `room_operating_hours`
- Booking: `bookings`, approvals และ status history พร้อม GiST exclusion constraint
- Key: physical inventory, loans, histories, incidents และ compensations
- Communication/operations: notifications, deliveries, audit logs และ reporting views
- Configuration: global booking/system rules และ per-room usage policy
- การเปลี่ยนสถานะสำคัญดำเนินการผ่าน `SECURITY DEFINER` RPC ที่กำหนด `search_path=''`

## 3. Migration Inventory

| ลำดับ | ไฟล์ | ผลสำคัญ |
|---:|---|---|
| 0001 | `0001_schema.sql` | schema, enum, 27 ตารางฐาน, triggers พื้นฐาน |
| 0002 | `0002_functions.sql` | RBAC helper และ workflow RPC รุ่นแรก |
| 0003 | `0003_rls_views_indexes.sql` | views, RLS, grants และ indexes รุ่นแรก |
| 0004 | `0004_verify_foundation.sql` | assertion ตรวจ foundation ณ เวลานั้น |
| 0005 | `0005_v2_schema_rbac.sql` | V2 enums/columns, external parties, RBAC เพิ่มเติม |
| 0006 | `0006_v2_workflow_functions.sql` | V2 booking/key workflows |
| 0007 | `0007_v2_rls_views_indexes.sql` | RLS/views/indexes V2 และรายงาน |
| 0008 | `0008_academic_schedule_management.sql` | recurring academic schedule management |
| 0009 | `0009_fix_room_schedule_feed_order.sql` | แก้ผลลัพธ์ feed/order ของ schedule RPC |
| 0010 | `0010_align_rooms_with_itd_floor_map.sql` | seed/ปรับข้อมูลห้องให้ตรงแผนผัง ITD |
| 0011 | `0011_public_room_schedule_api.sql` | public room/catalog schedule API |
| 0012 | `0012_admin_room_map_management.sql` | admin เปิด/ปิดห้อง |
| 0013 | `0013_public_room_status_and_saturday_holiday.sql` | room status และ closed-weekday trigger |
| 0014 | `0014_academic_term_settings.sql` | `academic_terms` และ upsert RPC |
| 0015 | `0015_academic_schedule_conflict_details.sql` | conflict detail RPC |
| 0016 | `0016_admin_room_details.sql` | room-detail update RPC |
| 0017 | `0017_external_booking_edit.sql` | external booking edit และ availability ล่าสุด |
| 0018 | `0018_room_layout_key_and_code_edit.sql` | `rooms.layout_key`, catalog และ room update V2 |
| 0019 | `0019_student_booking_key_workflow.sql` | student booking/key workflow และ triggers |
| 0020 | `0020_calendar_booking_notifications_and_key_reports.sql` | booking/calendar/notification/key report logic |
| 0021 | `0021_user_reported_key_status_and_notification_reads.sql` | notification reads และ user key reports |
| 0022 | `0022_configurable_usage_permissions.sql` | global configurable usage permission |
| 0023 | `0023_room_permission_matrix_and_key_availability.sql` | per-room matrix, key availability, cabinet |
| 0024 | `0024_self_service_key_return.sql` | self-service return และ single holder |
| 0025 | `0025_self_service_booking_key_approval.sql` | self-service booking-key approval |
| 0026 | `0026_extend_booking_close_time.sql` | เปลี่ยนเวลาปิดเป็น 18:30 |
| 0027 | `0027_finalize_expired_bookings.sql` | reconcile booking หมดเวลาและ cancel guard |

ลำดับข้างต้นมาจากชื่อไฟล์แบบ zero-padded และ dependency ภายใน SQL ซึ่งสอดคล้องกัน ไม่ได้อาศัย remote migration table

## 4. Categorized SQL Reference Structure

- `reference/01_core_schema.sql`: types, tables, constraints และ relationships
- `reference/02_auth_rls_permissions.sql`: Auth, RBAC, RLS และ grants
- `reference/03_rooms_academic.sql`: ห้อง ตารางเรียน ภาคเรียน และ availability
- `reference/04_booking_workflows.sql`: booking lifecycle และ conflicts
- `reference/05_key_management.sql`: inventory, loan, checkout/return และ incidents
- `reference/06_notifications_reports.sql`: notification, audit และ reporting views
- `reference/07_settings_configuration.sql`: rules, settings และ permission matrix

แต่ละ object มี canonical category เพียงหมวดเดียว หมวดอื่นอ้างชื่อและ source เท่านั้น

## 5. Tables and Relationships

Static inventory พบ public tables 30 ตาราง: foundation 27 ตารางจาก `0001` และเพิ่ม `external_parties`, `academic_terms`, `room_usage_policies` ตามลำดับ ตารางหลักเชื่อมผ่าน UUID foreign keys; history/audit ใช้ identity key เพื่อเก็บลำดับเหตุการณ์

ความสัมพันธ์สำคัญคือ booking ผูก requester/beneficiary/external party และ room; key loan ผูก room เสมอ แต่ `booking_id`, `class_schedule_id`, `key_id` เปลี่ยนเป็น nullable ตาม usage source; notification ผูกผู้ใช้โดยตรง

## 6. Functions and Procedures

พบชื่อ function ใน migration 55 ชื่อ (นับชื่อไม่ซ้ำ ไม่ใช่ overload signature count) กลุ่มหลักได้แก่ authorization helpers, availability, booking workflow, academic schedule, key workflow, notification/audit, reporting และ configuration RPC

คำว่า “latest” ใน reference หมายถึง definition สุดท้ายตาม migration order เท่านั้น การมี overload หรือ definition ที่สร้างแบบ conditional อาจต้องตรวจ `pg_proc` เพิ่มเติมในสภาพแวดล้อมจริง

## 7. Triggers

พบ literal trigger names 11 ชื่อ รวม auth profile creation, duplicate booking guard, booking-to-key-request, policy enforcement, single key holder, key checkout date, closed weekday และ updated-at ของตารางที่เพิ่มภายหลัง นอกจากนี้ `0001` สร้าง updated-at triggers อีก 6 ตัวด้วย dynamic SQL

## 8. Views and Indexes

พบ view ปัจจุบัน/ที่ถูกสร้างในประวัติ 10 ชื่อ ได้แก่ room/booking/key status, histories, pending bookings, operational summary และ reports พบ named indexes 23 ชื่อ โดย partial unique indexes ป้องกัน active key request/loan และ GiST exclusion constraint ป้องกัน booking ทับซ้อน

## 9. RLS Policies and Permissions

เมื่อนำ `CREATE POLICY` และ `DROP POLICY` มาใช้ตามลำดับ static reconstruction เหลือ policy ประมาณ 46 รายการบน 30 ตาราง Policies จำกัดข้อมูลผู้ใช้เองและใช้ `has_permission()` สำหรับงานผู้ดูแล Direct mutation ของตาราง workflow สำคัญถูก revoke และเปิดผ่าน RPC

จำนวนนี้เป็น **PARTIAL — STRUCTURAL VERIFICATION ONLY** เพราะไม่ได้อ่าน `pg_policies` จากฐานข้อมูลจริง

## 10. Booking Management Logic

`create_booking` ล่าสุดอยู่ใน `0020`; conflict engine ล่าสุดอยู่ใน `0017` การจองที่ `APPROVED`/`IN_USE` ป้องกัน overlap ทั้งด้วย RPC และ database exclusion constraint ห้อง/นโยบายกำหนดได้ว่าจองอัตโนมัติหรือรออนุมัติ

`0027` เพิ่ม `reconcile_expired_bookings()` เพื่อเปลี่ยนรายการที่เลย `ends_at` เป็น `COMPLETED` พร้อม history/audit และไม่ให้ยกเลิกหลังหมดเวลา การทำงานนี้ขึ้นกับการเรียก RPC ไม่มี scheduler ใน migration

## 11. Academic Schedule Management

ตารางเรียนรองรับ recurring weekly occurrence, effective date range, teacher, term และสถานะ การ upsert ตรวจชนกับตารางเรียน การจอง และ room blocks ใช้ timezone `Asia/Bangkok` Public feed แสดงข้อมูลที่ลดรายละเอียดตามสิทธิ์

## 12. Room Key Management Logic

รองรับ key source จาก booking, class schedule และ direct usage การเบิกสำหรับ booking ล่าสุดเป็น self-service หลังผ่าน eligibility (`0025`) และการคืนที่ถูกต้องเปลี่ยนเป็น `RETURNED` พร้อมทำ physical key `AVAILABLE` ทันที (`0024`) ไม่ต้องรอ admin ยืนยัน

Trigger ป้องกันผู้ถือกุญแจห้องเดียวกันซ้ำ และ database indexes ป้องกัน active physical key loan ซ้ำ สถานะตู้กุญแจเป็นข้อมูล runtime จึงต้องอ่าน loan/key rows ปัจจุบัน

## 13. Notifications and Reporting

Notification มี read state ต่อผู้ใช้และ delivery state แยก channel การ mark read ทำผ่าน owner-scoped RPC Audit logs บันทึก metadata ของการเปลี่ยน workflow รายงานใช้ views ที่กำหนด grants/RLS; การมี EMAIL delivery row ไม่ยืนยันว่ามีระบบส่งอีเมลภายนอกทำงานแล้ว

## 14. Configuration and Business Rules

`booking_rules` และ `system_settings` เก็บ JSONB settings; `room_usage_policies` เพิ่ม per-room matrix ค่าเวลาปิดล่าสุดใน migration คือ 18:30 (`0026`) กฎ runtime อาจถูก admin เปลี่ยนแล้ว จึงไม่ควรถือ seed เป็นค่าปัจจุบันของ remote เสมอ

## 15. Superseded SQL Definitions

- `check_room_availability`: 0002 → 0006 → **0017**
- `create_booking`: 0002 → 0006 → **0020**
- `cancel_booking`: 0002 → **0027**
- `get_public_room_catalog`: 0011 → 0013 → 0018 → **0023**
- `get_public_room_schedule_events`: 0011 → 0020 → **0023**
- `get_room_slot_permissions`: 0019 → 0022 → **0023**
- `request_class_key`: 0019 → 0022 → **0023**
- `request_booking_key`: 0019 → 0023 → **0025**
- `report_key_status`: 0021 → **0024**
- `get_admin_key_cabinet`: 0023 → **0024**
- `ensure_key_request_for_booking`: 0019 → **0025**

รายการ definition เก่าเป็นประวัติ migration และห้ามลบหรือแก้ย้อนหลัง

## 16. Migration-to-Reference Mapping

| Reference | Migrations หลัก |
|---|---|
| 01 Core | 0001, 0005, 0008, 0014, 0018, 0021, 0023 |
| 02 Auth/RLS | 0001–0003, 0005–0007, 0014, 0023 |
| 03 Rooms/Academic | 0001, 0005–0006, 0008–0018, 0020, 0023, 0026 |
| 04 Booking | 0001–0007, 0017, 0019–0020, 0022–0023, 0025, 0027 |
| 05 Keys | 0001–0007, 0019–0025 |
| 06 Notifications/Reports | 0001–0003, 0006–0007, 0020–0021, 0023–0027 |
| 07 Settings | 0001, 0005, 0013–0014, 0022–0023, 0026 |

## 17. Dependencies and Known Limitations

- วิเคราะห์เฉพาะ repository; ไม่เข้าถึง local/remote database หรือ credentials
- Conditional/data-dependent SQL และข้อมูล seed ที่ถูกแก้ภายหลังไม่สามารถยืนยันค่าปัจจุบันได้
- `0004` ยืนยัน foundation ณ จุดเวลาเดิม ไม่ใช่จำนวน object ล่าสุดหลัง 0005–0027
- จำนวน function ใช้ชื่อไม่ซ้ำ ไม่ได้แยก overload
- RLS count เป็น static estimate; remote drift ถูกระบุเป็น **UNVERIFIED**
- Authenticated end-to-end/database authorization tests: **NOT RUN — AUTH TEST USERS REQUIRED**

## 18. Developer Maintenance Guidelines

1. เปลี่ยนฐานข้อมูลด้วย migration ใหม่ที่เรียงลำดับเท่านั้น ห้ามใช้ reference files deploy
2. หลัง schema/RPC เปลี่ยน ให้ regenerate `src/lib/supabase/database.types.ts`
3. อัปเดต reference category ของ object และ superseded mapping โดยไม่แก้ migration เก่า
4. ตรวจ RLS, grants, fixed `search_path`, transitions, constraints และ concurrency ทุกครั้ง
5. ใช้ dry-run ใน environment ที่ระบุชัด และห้าม push cloud โดยไม่มีคำสั่งชัดเจน
6. ทบทวน `git diff` และยืนยันว่ามีเฉพาะเอกสารก่อน commit
