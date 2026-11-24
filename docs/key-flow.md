# Key flow

Account history shows booking cards in the booking tab. Key loans, including loans created from a booking, appear in the key tab alongside direct key requests. Key-loan notifications open the loan in that tab.

Staff can set the public key catalog to the current layout, key tags, or
the current layout without checkout history. The last option omits the
checkout history query and section on both catalog tabs. Schedule availability
and the history on each room detail page remain available.

The admin display setting for elapsed room slots defaults to enabled. It
controls the daily schedule on key and meeting room detail pages. Availability
and time selection continue to follow the existing room policy.

Public key request forms show the requester status, name, and email. New requests omit the student or staff identifier. The request RPCs still accept an identifier from older clients. Time pickers hide elapsed starts, disable booked half-hours, and offer continuous end times up to the next blocked slot.

Guests see the Google sign-in dialog before entering the key form when the room type or its category requires login. `get_public_key_login_required_rooms` exposes only matching rooms the caller can see. The form and submission still enforce sign-in on direct entry and when a request is sent.

The room detail page remembers its selected range in the current browser tab. Starting the form from a new room selection replaces the draft's date and times while preserving its other fields. Returning through the bottom navigation restores later edits made in the form.

The key form and review show the same primary account role as the site header. Lecturer selection and the submitted requester type continue to use the student or teacher classification.

The key catalog, room schedule, and form use the room category's Bangkok opening and closing times. The default window is 08:00–18:00. Closing time is an end-only option. The database enforces the same window on new requests and time changes, and the form checks for policy changes before confirmation.

For S2407–S2412, `get_room_slot_permissions` is the single decision boundary used by the room dialog. During an active class occurrence, every authenticated Student may create an auto-approved class key request; Teacher is intentionally supported by the same database rule for later UI reuse. This rule does not depend on enrollment data. Without a class, the user must own an approved room booking before requesting a key. Another user's booking never grants key permission.

An auto-approved request is permission to receive a key, not proof of physical handover. S2407–S2412 currently have no tracked `room_keys` seed records, so an Admin must configure physical copies before CHECKED_OUT inventory can be assigned. Booking-derived key requests remain REQUESTED until staff approval.

The borrower completes a normal return through `report_key_status` without waiting for an Admin. The loan becomes `RETURNED`, an assigned physical key becomes `AVAILABLE`, and history/audit evidence retains the responsible actor and time. Lost or damaged reports remain terminal unavailable states for operational follow-up.

For a CHECKED_OUT or LATE loan, the borrower may report LOST or DAMAGED through `report_key_issue`; ownership and transition validity are checked in the database. Admin assigns an AVAILABLE physical `room_keys` record when handing over an APPROVED request.

Row locks plus partial unique indexes prevent double checkout. All transitions append history and critical events append audit records. Rejection/cancellation of key requests and incident/compensation-specific RPCs remain future operational additions once exact procedures are confirmed.

Migration `0021_user_reported_key_status_and_notification_reads.sql` introduced borrower lifecycle reporting and the intermediate `RETURN_REPORTED` state. Migration `0024_self_service_key_return.sql` supersedes that intermediate normal-return behavior: new borrower returns complete directly as `RETURNED`, while every action still writes history and an audit event. Room-level loans may be recorded before a physical `room_keys` copy is configured, while incidents still retain the responsible loan and user.

Migration `0023_room_permission_matrix_and_key_availability.sql` makes Student key eligibility configurable per room. A booking-derived request and its transition to `CHECKED_OUT` are both rejected before the booking's Bangkok calendar date; the account UI mirrors that rule by disabling the checkout action and displaying the first available date. This keeps the database authoritative even if a client bypasses the interface.

Migration `0024_self_service_key_return.sql` changes the confirmed operational model to borrower self-service. A borrower return completes as `RETURNED` immediately and releases an assigned physical key to `AVAILABLE`; no Admin receipt confirmation is required. Checkout is serialized with a room-level advisory lock and rejects a second `CHECKED_OUT`/`LATE` holder for the same room. Lost and damaged keys remain unavailable and retain incident/audit evidence.

Migration `0025_self_service_booking_key_approval.sql` removes Admin approval from booking-derived key requests. Once the room booking is approved and the Bangkok booking date has arrived, an eligible borrower request is created as `APPROVED` immediately and the borrower can confirm `CHECKED_OUT` themselves. The Admin key list is operational monitoring only; booking approval remains the sole Admin approval step.

Migration `0028_overdue_key_cabinet_and_borrower_identity.sql` distinguishes an active in-period checkout (`CHECKED_OUT`, yellow) from a key that remains held after `expected_return_at` (`OVERDUE`, red). A closed room is gray; an overdue holder takes visual precedence so an outstanding key cannot be hidden by room availability. The Admin activity view also exposes the borrower's profile name and university id, with email/system id reserved as UI fallbacks.

Authenticated public `key_requests` mirror submission and lifecycle status changes into in-app notifications. Email outbox behavior remains separate; the in-app trigger creates only an `IN_APP` delivery and skips legacy requests without an authenticated owner.

For teaching requests, the requester enters the course code independently of the lecturer.
Students select an instructor by name from a searchable list. Signed-in users
can search active Teacher accounts and preassigned Teacher members with an eligible
university email. The existing instructor entries support guest requests, and
the explicit test recipient remains available. The list shows one entry per
normalized email and returns only IDs and display names. The database resolves
the selected ID again on submission and uses the existing lecturer notification
outbox event.

The display settings page controls the preferred instructor name language for
the staff directory and the student instructor picker. Staff can edit both
name variants for Teacher entries, including preassigned members. A missing
localized name falls back to the original directory name. Search can match
both saved variants. The preference only affects the directory and picker;
previous requests retain their recorded details.
Teacher requests continue to identify the requester as the instructor.
Before a request starts, its owner can adjust the time on the original Bangkok service date. The history editor uses the room schedule without the current request's interval and the database rechecks conflicts on save. Teaching requests retain their recorded teaching purpose and lecturer details.
## สถานะคืนกุญแจในรายการบันทึก

แดชบอร์ดเจ้าหน้าที่แสดง **เกินกำหนด** เมื่อรายการเบิกที่อนุมัติแล้วหรือกำลังใช้งานเลยเวลาสิ้นสุดและยังไม่มีเวลาคืนจริง รวมถึงรายการยืมที่ยังถือกุญแจอยู่ หากบันทึกคืนหลังเวลาสิ้นสุดจะแสดง **คืนล่าช้า** ส่วนการคืนตรงเวลาหรือก่อนกำหนดแสดง **คืนแล้ว** รายงาน PDF ใช้เกณฑ์เดียวกัน ณ เวลาที่สร้างรายงาน การคำนวณนี้ใช้สำหรับการแสดงผลและไม่เปลี่ยนสถานะในฐานข้อมูล

สำหรับคำขอห้องพิเศษที่ยังรออนุมัติ ตั้งแต่เวลาเริ่มจนถึงก่อนเวลาสิ้นสุดจะแสดง **รออนุมัติ · เริ่มแล้ว** เจ้าหน้าที่ยังอนุมัติให้ใช้เวลาที่เหลือได้ โดยเก็บช่วงเวลาที่ขอไว้ในประวัติ เมื่อถึงเวลาสิ้นสุดจะแสดง **หมดอายุ** และฐานข้อมูลจะปฏิเสธการอนุมัติหรือไม่อนุมัติคำขอนั้น

## การตรวจรับกุญแจในแดชบอร์ดแอดมิน

ผู้มีสิทธิ์ `KEY_MANAGE` สามารถยืนยันว่าได้รับกุญแจจริงจากรายการ **เกินกำหนด** โดยระบบบันทึกการคืนให้คำขอและรายการยืมที่แสดงในแดชบอร์ดของห้องเดียวกันซึ่งสิ้นสุดเวลาแล้วและยังไม่ได้คืน ครอบคลุมรายการนอกหน้าปัจจุบันและนอกตัวกรอง ระบบแสดง **คืนแล้ว** สำหรับการตรวจรับครั้งนี้ พร้อมบันทึกเวลาคืนและผู้ตรวจรับในประวัติการตรวจสอบ
