# Staff Management Design

## Intent
สร้างศูนย์จัดการ `/staff` สำหรับผู้ดูแลระบบของ ITD336 ครบ 16 routes โดยคง `/admin` เดิม และเชื่อมข้อมูลจริงเท่าที่ Backend ปัจจุบันอนุญาต

## Goals
- ใช้ `ADMIN` guard เดิมกับทุก staff route
- มี responsive shell, navigation, loading, empty และ error states
- reuse room, booking และ key queries/services ที่มีอยู่
- ระบุข้อจำกัดอย่างชัดเจนเมื่อไม่มี authorized backend operation

## Non-goals / anti-goals
- ไม่เปลี่ยน Auth, role mapping, database, migrations, RLS หรือ RPC
- ไม่สร้าง fake API/data และไม่เปลี่ยน production data ระหว่างทดสอบ
- ไม่แก้ ลบ commit push หรือ deploy งานเดิมใน `/admin`

## Approach
พิจารณาแล้วสามแนวทาง: เปลี่ยน `/admin` เป็น `/staff` (กระทบงานเดิม), ทำ static mock ทั้งหมด (ไม่ตรง functional requirements), และสร้าง feature `staff` ใหม่ที่ reuse data layer เดิม แนวทางที่เลือกคือข้อสาม เพราะแยก scope ชัดและรักษาระบบทดลองเดิมของผู้ใช้

## Architecture
`App` ใช้ guard เดิมครอบ `StaffLayout`; navigation และ page metadata อยู่ใน feature `staff`. หน้า data-driven ใช้ TanStack Query definitions เดิมสำหรับ rooms, bookings และ keys. หน้า users/meeting-room forms/settings แสดงเฉพาะความสามารถที่ยืนยันได้และ backend limitation เมื่อไม่มี authorized mutation. Reports ใช้ข้อมูลจริงและ browser print dialog สำหรับ Save as PDF.

## Constraints
รักษา feature-driven architecture, Tailwind v4 conventions, strict TypeScript, accessibility พื้นฐาน และ responsive ตั้งแต่ 320–1440px. ไฟล์ handwritten ควรอยู่ราว 250–300 บรรทัดหรือน้อยกว่า.

