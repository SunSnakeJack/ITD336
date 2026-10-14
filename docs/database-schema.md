# Database schema

## Identity and authorization

`auth.users` 1—1 `profiles`; profiles optionally belong to `organizations`. `profiles` M—N `roles` through `user_roles`; roles M—N `permissions` through `role_permissions`.

## Rooms and schedules

`room_types` 1—N `rooms`; rooms M—N `equipment` through `room_equipment`. Rooms have concrete `class_schedules`, `room_blocks`, optional `room_operating_hours`, bookings, and multiple individually coded `room_keys`.

## Booking lifecycle

`profiles` request or create `bookings`; beneficiary users and `external_parties` are represented separately from the authenticated actor. Each booking has append-only history and may point to its priority replacement through `superseded_by_booking_id`. A GiST exclusion constraint prevents overlapping APPROVED/IN_USE bookings.

## Key lifecycle

A `key_loan` identifies its room and is authorized by one of `BOOKING`, `CLASS_SCHEDULE`, or `DIRECT_USAGE`; a booking is no longer mandatory. Checkout assigns a tracked physical `room_key`. User-reported return and physical verification are separate evidence fields. Permanent housekeeper keys are marked outside operational tracking.

## Messaging and governance

`notifications` belong to users and have channel-specific `notification_deliveries`. `booking_rules`, `system_settings`, and `holidays` keep uncertain policy configurable. `audit_logs` capture controlled business events and cannot be inserted by normal clients.

Enumerations constrain operational states. Foreign keys default to restrictive deletion or `set null`; only join/delivery records use cascade where loss of the parent makes them meaningless.
