# Booking flow

1. Search active, booking-enabled rooms with `list_available_rooms(start, end)`.
2. `create_booking` validates authentication, room state, future time range, blocks, teaching occurrences, and active bookings; it creates PENDING history, audit, and notification records.
3. Authorized staff call `approve_booking` or `reject_booking`. Approval locks the booking, serializes on the room, and rechecks availability. Rejection requires a reason.
4. The eventual operations layer may transition APPROVED → IN_USE → COMPLETED through additional controlled RPCs; these transitions are not invented in this phase.
5. The requester or a user with `BOOKING_MANAGE` can call `cancel_booking` only from PENDING/APPROVED. The row and its history remain.

Invalid transitions such as CANCELLED → APPROVED fail. The final exclusion constraint handles concurrent approvals even if two sessions pass an earlier read.
