# Permissions and RLS

STUDENT and TEACHER receive no administrative permission by default. They can read active room catalogs, their own profile, bookings, key loans, incidents/compensation relevant to them, and notifications. Booking/key requests use authenticated RPCs.

STAFF is seeded with all current permissions: `ROOM_MANAGE`, `SCHEDULE_MANAGE`, `BOOKING_READ_ALL`, `BOOKING_APPROVE`, `BOOKING_MANAGE`, `KEY_MANAGE`, `USER_MANAGE`, `SETTINGS_MANAGE`, `AUDIT_READ`, and `REPORT_READ`.

Role membership cannot be written by browser clients. Critical tables revoke direct mutation even though RLS is enabled. Profile self-update is column-granted only for name, university ID, and phone, preventing account-status or organization spoofing. Staff transitions are still validated inside RPCs; possession of a role label alone grants nothing.

Use a trusted administrative service/SQL session to assign roles. Never expose the service-role key to a browser.
