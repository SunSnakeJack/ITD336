# Booking flow

1. Search active, booking-enabled rooms with `list_available_rooms(start, end)`.
2. `create_booking` validates authentication, room state, the rolling three-day limit, 08:30–17:30 Bangkok time, schedules, blocks, and active bookings.
3. General rooms auto-confirm. Studio, Gaming/E-sport, and E-learning remain PENDING for Admin approval. Teachers and Admins may auto-confirm Cold Room; Students cannot book it.
4. `override_booking` lets a narrowly authorized Priority User supersede an ordinary active booking transactionally. Protected schedules and room blocks still reject the override.
5. The eventual operations layer may transition APPROVED → IN_USE → COMPLETED through additional controlled RPCs.
6. The requester or a user with `BOOKING_MANAGE` can cancel PENDING/APPROVED bookings; rows and history remain.

Invalid transitions such as CANCELLED → APPROVED fail. The final exclusion constraint handles concurrent approvals even if two sessions pass an earlier read.
