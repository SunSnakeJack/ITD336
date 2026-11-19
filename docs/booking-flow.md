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

The meeting-room form reads eligible Bangkok dates and operating hours from
`get_meeting_booking_policy`. Today is available in Bangkok during bookable
hours and is additional to the configured number of future dates. Closed
Saturdays are skipped and the configured Saturday exception is honored.
In Staff Permission Settings, users with `SETTINGS_MANAGE` can set the limit
to 1–30 days (default 3). Each change is audited and applies to new meeting
bookings. Both meeting booking RPC paths enforce the same eligible dates.
The meeting booking form displays the authenticated requester's role, name, and email. Start options omit elapsed times on the selected Bangkok date and disable blocked half-hours. End options stop at the first conflicting half-hour. The booking RPC makes the final availability and permission decision.
Meeting rooms use 08:00–18:00 Bangkok operating hours and auto-confirm
new requests once role, date, hours and overlap checks pass. A caller with
`BOOKING_OVERRIDE` can supersede one ordinary approved booking that has
yet to start. Remaining portions of the displaced reservation are retained
and the requester is notified through the existing override workflow.
Priority bookings, pending reservations, active use, class schedules and
room blocks prevent displacement. The staff usage dashboard reports
approved, in-use and completed bookings for meeting rooms.

The meeting room's weekly view is read-only. It shows the previous, current,
and next Sunday-to-Saturday weeks in Bangkok time. The public calendar RPC
returns operating hours, event times and coarse display categories, and
honors the room's schedule visibility policy. Completed bookings remain
visible within this window. The admin advance-booking setting controls request
submission separately from the calendar's display range.
The meeting room detail opens on the upcoming tab and lists up to five
future bookings, earliest start first, with pending requests marked. The
history tab lists up to five elapsed bookings, latest start first. The weekly event dialog includes
the requester name and booking purpose for the requester or users with
`BOOKING_MANAGE` or `BOOKING_APPROVE`. History and calendar entries for other
viewers expose only times and display categories.
