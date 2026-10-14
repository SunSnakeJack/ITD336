# Permissions and RLS

STUDENT and TEACHER receive no administrative permission by default. They can read active room catalogs, their own profile, bookings, key loans, incidents/compensation relevant to them, and notifications. Booking/key requests use authenticated RPCs.

V2 makes `STAFF` read-only with `ROOM_READ_ALL`, `SCHEDULE_READ_ALL`, `OCCUPANCY_READ`, and `REPORT_READ`. `ADMIN` receives management permissions. `PRIORITY_USER` receives only `BOOKING_OVERRIDE`; it can be combined with a base role without inheriting Admin authority.

Role membership cannot be written by browser clients. Critical tables revoke direct mutation even though RLS is enabled. Profile self-update is column-granted only for name, university ID, and phone, preventing account-status or organization spoofing. Staff transitions are still validated inside RPCs; possession of a role label alone grants nothing.

Use a trusted administrative service/SQL session to assign roles. Never expose the service-role key to a browser.
