# Approved Baseline Database ERD

This diagram shows the additive baseline structures. Existing RBAC, room, booking, key-loan, notification, and audit tables remain authoritative during transition.

```mermaid
erDiagram
  PROFILES ||--o{ USER_ROLES : assigned
  ROLES ||--o{ USER_ROLES : contains
  ROLES ||--o{ ROLE_PERMISSIONS : grants
  PERMISSIONS ||--o{ ROLE_PERMISSIONS : maps
  ROOM_TYPES ||--o{ ROOMS : classifies
  ROOMS ||--o{ CLASS_SCHEDULES : schedules
  ROOMS ||--o{ KEY_REQUESTS : requested_for
  PROFILES o|--o{ KEY_REQUESTS : authenticates
  KEY_REQUESTS ||--o{ KEY_REQUEST_STATUS_HISTORY : records
  KEY_REQUESTS ||--o{ SECURE_ACTION_TOKENS : authorizes
  KEY_REQUESTS ||--o{ NOTIFICATION_OUTBOX : emits
  ROOMS ||--o{ BOOKINGS : reserved_as
  BOOKINGS ||--o{ BOOKING_SEGMENTS : divided_into
  BOOKINGS o|--o{ BOOKING_SEGMENTS : displaces
  SYNC_RUNS ||--o{ SYNC_CHANGE_IMPACTS : records
  ROOMS o|--o{ SYNC_CHANGE_IMPACTS : affects
  BOOKINGS o|--o{ SYNC_CHANGE_IMPACTS : affects
  PROFILES ||--o{ ANNOUNCEMENTS : publishes
  ROOMS ||--o{ KEY_LOANS : legacy_usage
  ROOM_KEYS o|--o{ KEY_LOANS : legacy_copy
```

## Key invariants

- `no_overlapping_active_key_requests` prevents overlapping pending, approved, or in-use requests for the same room.
- `key_requests.authenticated_user_id` is nullable for ordinary laboratory requests but mandatory at the RPC boundary for room types requiring SSO.
- `booking_segments` retains unaffected intervals after a priority displacement.
- `secure_action_tokens` stores only token digests; expiry and one-time use are checked under row lock.
- `notification_outbox.idempotency_key` prevents duplicate logical delivery jobs.
- `room_keys` and `key_loans` are preserved for compatibility and historical data, but new baseline requests do not depend on them.
