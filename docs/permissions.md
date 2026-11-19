# Permissions and RLS

STUDENT and TEACHER receive no administrative permission by default. They can read active room catalogs, their own profile, bookings, key loans, incidents/compensation relevant to them, and notifications. Booking/key requests use authenticated RPCs. For an active class occurrence in S2407–S2412, either role receives class-derived key permission; Student is the current UI focus and no enrollment lookup is required.

On the first sign-in with a verified email, the database consumes the matching preassigned role or grants `STUDENT` when no preassignment exists. An existing role assignment takes precedence. Later sign-ins do not restore roles removed by an administrator.

Administrators can remove a pending preassignment or remove a registered user from the staff directory. For a registered user, the removal bans future sign-ins and marks the profile inactive while retaining its ID and linked history. Each removal is audited. The acting administrator cannot remove their own account.

To prepare the faculty roster after migration `0083`, run `pwsh -File scripts/prepare-faculty-role-import.ps1 -Workbook <xlsx-path> -OutputSql <new-private-sql-path>`. Run the generated SQL as a database administrator against the intended environment. It skips existing accounts and preassignments and reports counts without printing contact details. Keep the generated file out of Git. Imported teachers appear in the admin directory as awaiting first sign-in. Importing the roster does not create Auth accounts or send invitations.

V2 makes `STAFF` read-only with `ROOM_READ_ALL`, `SCHEDULE_READ_ALL`, `OCCUPANCY_READ`, and `REPORT_READ`. `ADMIN` receives management permissions. `PRIORITY_USER` receives only `BOOKING_OVERRIDE`; it can be combined with a base role without inheriting Admin authority.

Role membership cannot be written by browser clients. Critical tables revoke direct mutation even though RLS is enabled. Profile self-update is column-granted only for name, university ID, and phone, preventing account-status or organization spoofing. Staff transitions are still validated inside RPCs; possession of a role label alone grants nothing.

The staff user directory and role editor use narrowly scoped `ADMIN`-authorized RPCs. Role replacement is transactional, validates every requested role, records an audit event, and prevents removing the final Admin role. Browser clients still cannot mutate `user_roles` directly. Never expose the service-role key to a browser.

Member invitations and account suspension/reactivation run through the JWT-protected `admin-user-management` Edge Function. It verifies the caller's active Admin role before using Supabase Auth Admin APIs. The existing `on_auth_user_created` trigger creates `profiles` automatically; browser clients never create Auth users directly. `INACTIVE` is a recoverable soft removal that preserves bookings and audit history.

The Edge Function checks `has_role('ADMIN')` using the caller's verified Authorization header. This reuses the database's active-account role rule without depending on PostgREST embedded relationships. Authorization query failures return `AUTHORIZATION_CHECK_FAILED`; server logs record only the error code. Migration 0066 grants the server-only service role the specific reads, role assignment inserts, account_status update, and audit insertion needed by this function; browser grants are unchanged. Function code changes require deployment before live verification. Authenticated suspension/reactivation verification: NOT RUN — AUTH TEST USERS REQUIRED.

Staff room creation and editing require `ROOM_MANAGE`. The browser sends room and equipment form state to guarded RPCs; it cannot write `rooms` or `room_equipment` directly. Each successful create or update records an audit event.

The consolidated usage dashboard calls `get_staff_usage_history`, which requires `REPORT_READ` or `ROOM_MANAGE`. The RPC exposes only the fields required for authorized reporting and does not grant direct browser access to profile, booking, or key-loan tables.

Changing the elapsed key-request slot exception requires `SETTINGS_MANAGE`. Reading its boolean value is public because it contains no sensitive data and is required for consistent catalog UI; the database insert trigger remains the enforcement boundary.
# Saturday booking exception

The permission settings page lets a user with `SETTINGS_MANAGE` open one specified Saturday for room bookings and key requests. The exception expires when that date ends in Asia/Bangkok. The change is audited and the public policy returns only the current exception date. Existing booking limits, elapsed-slot settings, and academic schedule rules apply independently.
The staff role picker offers Dean and Head of Department. Both inherit the priority booking permissions. Existing PRIORITY_USER assignments remain effective until an administrator selects a replacement on the account. Public account badges show คณบดี and หัวหน้าสาขา, and the request forms display both as อาจารย์.
