# Database schema

## Identity and authorization

`auth.users` 1—1 `profiles`; profiles optionally belong to `organizations`. `profiles` M—N `roles` through `user_roles`; roles M—N `permissions` through `role_permissions`.

## Rooms and schedules

`room_types` 1—N `rooms`; rooms M—N `equipment` through `room_equipment`. Rooms have concrete `class_schedules`, `room_blocks`, optional `room_operating_hours`, bookings, and multiple individually coded `room_keys`.

Migration `0008_academic_schedule_management.sql` extends rooms with an administrator-owned academic-schedule confirmation state. It extends class schedules with weekday, local time, effective-range, and update-audit fields. Schedule creation/update/deactivation and confirmation are controlled by `SCHEDULE_MANAGE`; the shared schedule-feed RPC requires authentication and hides booking/block detail unless the caller has the appropriate read permission.

Migration `0010_align_rooms_with_itd_floor_map.sql` preserves the existing six room UUIDs while aligning their catalog labels with the approved ITD map and adds the four missing laboratory rooms `S2409`–`S2412`. Floor-plan position and non-room landmarks are not database records.

Migration `0011_public_room_schedule_api.sql` exposes a narrow anonymous read surface through `get_public_room_catalog` and `get_public_room_schedule_events`. It does not grant anonymous table access and removes booking identities, source identifiers, purposes, and internal block reasons from guest responses.

Migration `0012_admin_room_map_management.sql` adds the general classroom type and rooms `2401`–`2406` so every Admin map target has a stable UUID. The `set_room_availability` RPC requires `ROOM_MANAGE`, changes active/booking state atomically, and records the before/after state in `audit_logs`.

Migration `0016_admin_room_details.sql` adds the `update_room_details` RPC. It requires `ROOM_MANAGE`, validates the room name and capacity, keeps `active` and `booking_enabled` aligned, and records the before/after change in `audit_logs`.

Migration `0017_external_booking_edit.sql` updates exact-time availability checks to expand recurring academic schedules and adds permission-checked read/update RPCs for approved external-party bookings. Updates exclude the current booking from overlap checks, retain booking history, and append an audit event.

Migration `0018_room_layout_key_and_code_edit.sql` separates the immutable floor-plan `layout_key` from the editable room `code`, extends the narrow public catalog with that key, and adds the permission-checked `update_room_details_v2` RPC. The RPC validates and normalizes room codes, preserves uniqueness, updates the room identity and availability fields atomically, and appends an audit event.

Migration `0019_student_booking_key_workflow.sql` adds database-owned slot permissions for S2407–S2412, manual approval and pending-overlap protection for laboratory bookings, class- and booking-derived key-request RPCs, borrower damage reporting, automatic key-request creation after booking approval, and Realtime publication membership for operational tables. Class-derived permission is currently granted to every authenticated Student or Teacher during an active class occurrence; enrollment membership is intentionally not required by the confirmed rule.

Migration `0020_calendar_booking_notifications_and_key_reports.sql` changes the advance limit to Bangkok calendar days, exposes only a boolean ownership marker for privacy-safe schedule coloring, adds borrower-controlled LOST/DAMAGED reporting with incident and audit records, and publishes notifications through Realtime.

Migration `0013_public_room_status_and_saturday_holiday.sql` adds `active` to the privacy-safe public room catalog so closed rooms can be rendered without exposing direct table access. It records Saturday in `CLOSED_WEEKDAYS` and rejects new or reactivated Saturday academic schedules at the database boundary.

Migration `0014_academic_term_settings.sql` adds RLS-protected `academic_terms`. Authenticated users may read terms; changes require the `SETTINGS_MANAGE` permission through `upsert_academic_term`, which validates date ranges and writes an audit event. Recurring class schedules copy the selected term's year, code, and effective dates at save time so historical schedules remain stable when future term settings change.

Migration `0015_academic_schedule_conflict_details.sql` adds a read-only, `SCHEDULE_MANAGE`-protected conflict lookup used before schedule mutation. It returns only the conflicting class label, weekday, and time range needed for a clear Admin message; the transactional conflict checks in `upsert_academic_schedule` remain the final authority.

## Booking lifecycle

`profiles` request or create `bookings`; beneficiary users and `external_parties` are represented separately from the authenticated actor. Each booking has append-only history and may point to its priority replacement through `superseded_by_booking_id`. A GiST exclusion constraint prevents overlapping APPROVED/IN_USE bookings.

## Key lifecycle

A `key_loan` identifies its room and is authorized by one of `BOOKING`, `CLASS_SCHEDULE`, or `DIRECT_USAGE`; a booking is no longer mandatory. Checkout assigns a tracked physical `room_key`. User-reported return and physical verification are separate evidence fields. Permanent housekeeper keys are marked outside operational tracking.

## Messaging and governance

`notifications` belong to users and have channel-specific `notification_deliveries`. `booking_rules`, `system_settings`, and `holidays` keep uncertain policy configurable. `audit_logs` capture controlled business events and cannot be inserted by normal clients.

Enumerations constrain operational states. Foreign keys default to restrictive deletion or `set null`; only join/delivery records use cascade where loss of the parent makes them meaningless.
