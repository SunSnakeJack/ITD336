# Booking flow

1. Search active, booking-enabled rooms with `list_available_rooms(start, end)`.
2. `create_booking` validates authentication, room state, the three-calendar-day limit, the 08:30–18:30 Bangkok operating window, schedules, blocks, and active bookings. The final visible start slot is 17:30 and ends at 18:30.
   The public UI starts each display week on Sunday and treats the limit as Bangkok calendar days: remaining times today plus every operating-hour slot through the end of the third following date. Public navigation is limited to the current and next calendar week.
3. S2407–S2412 use manual approval: a free slot creates a PENDING booking, while a class occurrence or another active/pending booking refuses a new booking. Admin approves or rejects the request through the booking inbox.
4. After approval, the owner can request a key from the same booking. Booking overlap and ownership remain database-enforced.
5. `override_booking` lets a narrowly authorized Priority User supersede an ordinary active booking transactionally. Protected schedules and room blocks still reject the override.
6. Before account or Admin booking lists are read, `reconcile_expired_bookings` transitions elapsed APPROVED/IN_USE rows to COMPLETED with history and audit evidence. The UI labels this state “สิ้นสุดแล้ว”; it does not infer NO_SHOW because attendance is unknown.
7. The requester or a user with `BOOKING_MANAGE` can cancel a future PENDING/APPROVED booking. Both the UI and `cancel_booking` reject cancellation after `ends_at` has elapsed.

Invalid transitions such as CANCELLED → APPROVED fail. The final exclusion constraint handles concurrent approvals even if two sessions pass an earlier read.
