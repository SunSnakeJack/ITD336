# Database schema

## Identity and authorization

`auth.users` 1—1 `profiles`; profiles optionally belong to `organizations`. `profiles` M—N `roles` through `user_roles`; roles M—N `permissions` through `role_permissions`.

## Rooms and schedules

`room_types` 1—N `rooms`; rooms M—N `equipment` through `room_equipment`. Rooms have concrete `class_schedules`, `room_blocks`, optional `room_operating_hours`, bookings, and multiple individually coded `room_keys`.

## Booking lifecycle

`profiles` request `bookings` for rooms. Each booking has append-only `booking_status_history` and zero or more `booking_approvals`. Important rows are never deleted by client workflows. A GiST exclusion constraint prevents overlapping APPROVED/IN_USE bookings for the same room.

## Key lifecycle

An approved booking can own one active `key_loan` request. Checkout assigns a physical `room_key`; partial unique indexes prevent a key or booking from participating in two active loans. `key_loan_history` records transitions. Abnormal returns create `key_incidents`, which can have compensation records and later resolution.

## Messaging and governance

`notifications` belong to users and have channel-specific `notification_deliveries`. `booking_rules`, `system_settings`, and `holidays` keep uncertain policy configurable. `audit_logs` capture controlled business events and cannot be inserted by normal clients.

Enumerations constrain operational states. Foreign keys default to restrictive deletion or `set null`; only join/delivery records use cascade where loss of the parent makes them meaningless.
