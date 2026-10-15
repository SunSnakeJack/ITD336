# Database schema

## Identity and authorization

`auth.users` 1—1 `profiles`; profiles optionally belong to `organizations`. `profiles` M—N `roles` through `user_roles`; roles M—N `permissions` through `role_permissions`.

## Rooms and schedules

`room_types` 1—N `rooms`; rooms M—N `equipment` through `room_equipment`. Rooms have concrete `class_schedules`, `room_blocks`, optional `room_operating_hours`, bookings, and multiple individually coded `room_keys`.

Migration `0008_academic_schedule_management.sql` extends rooms with an administrator-owned academic-schedule confirmation state. It extends class schedules with weekday, local time, effective-range, and update-audit fields. Schedule creation/update/deactivation and confirmation are controlled by `SCHEDULE_MANAGE`; the shared schedule-feed RPC requires authentication and hides booking/block detail unless the caller has the appropriate read permission.

Migration `0010_align_rooms_with_itd_floor_map.sql` preserves the existing six room UUIDs while aligning their catalog labels with the approved ITD map and adds the four missing laboratory rooms `S2409`–`S2412`. Floor-plan position and non-room landmarks are not database records.

Migration `0011_public_room_schedule_api.sql` exposes a narrow anonymous read surface through `get_public_room_catalog` and `get_public_room_schedule_events`. It does not grant anonymous table access and removes booking identities, source identifiers, purposes, and internal block reasons from guest responses.

Migration `0012_admin_room_map_management.sql` adds the general classroom type and rooms `2401`–`2406` so every Admin map target has a stable UUID. The `set_room_availability` RPC requires `ROOM_MANAGE`, changes active/booking state atomically, and records the before/after state in `audit_logs`.

Migration `0013_public_room_status_and_saturday_holiday.sql` adds `active` to the privacy-safe public room catalog so closed rooms can be rendered without exposing direct table access. It records Saturday in `CLOSED_WEEKDAYS` and rejects new or reactivated Saturday academic schedules at the database boundary.

## Booking lifecycle

`profiles` request or create `bookings`; beneficiary users and `external_parties` are represented separately from the authenticated actor. Each booking has append-only history and may point to its priority replacement through `superseded_by_booking_id`. A GiST exclusion constraint prevents overlapping APPROVED/IN_USE bookings.

## Key lifecycle

A `key_loan` identifies its room and is authorized by one of `BOOKING`, `CLASS_SCHEDULE`, or `DIRECT_USAGE`; a booking is no longer mandatory. Checkout assigns a tracked physical `room_key`. User-reported return and physical verification are separate evidence fields. Permanent housekeeper keys are marked outside operational tracking.

## Messaging and governance

`notifications` belong to users and have channel-specific `notification_deliveries`. `booking_rules`, `system_settings`, and `holidays` keep uncertain policy configurable. `audit_logs` capture controlled business events and cannot be inserted by normal clients.

Enumerations constrain operational states. Foreign keys default to restrictive deletion or `set null`; only join/delivery records use cascade where loss of the parent makes them meaningless.
