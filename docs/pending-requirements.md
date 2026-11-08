# Pending requirements

## Approved baseline database migration — decisions still required

- Resolved 2026-11-08: anonymous visitors may see full requester names, time and status for the latest 10 key requests. Long names are visually truncated; email and university identifiers remain private.
- Confirm the concrete Northbkk SSO provider, claim mapping, account-disable synchronization, and authoritative personnel source. Roles must not be inferred from an email address.
- Confirm whether historical meeting reservations may be cancelled after their end time. The approved baseline says anytime, while the current `cancel_booking` RPC rejects elapsed bookings.
- Confirm how a new priority booking is introduced while the legacy whole-booking exclusion constraint is active. `booking_segments` safely models partial displacement, but application cutover needs a coordinated booking RPC migration.
- Confirm audit/history and notification retention periods, backup frequency, recovery objectives, and deletion/anonymization rules.
- Confirm the email delivery provider, worker authentication, retry ceiling, dead-letter operating procedure, and secure-link URL host.
- Confirm the authorized room/timetable source, JSON contract, automation identity, and handling of source deletions before enabling daily 08:00 synchronization.

The following need product-owner decisions before enforcement:

1. University account integration and SSO provider.
2. External-user eligibility, verification, and sponsoring organization policy.
3. Maximum bookings per user/day.
4. Whether the confirmed three-day advance limit means calendar days or an exact rolling duration (implemented provisionally as exact duration).
5. No-show detection and penalties.
6. History/audit retention and legal requirements.
7. Report/export formats.
8. Sunday staffing and exceptional-holiday policy; Saturday is confirmed closed and the general window is 08:30–18:30.
9. Whether housekeepers need a separate authenticated role; permanently assigned keys are excluded from loan tracking.
10. Teacher-specific presentation and delegation rules beyond the confirmed class-derived key permission shared with Students.
11. Recurring schedule source/format and occurrence expansion ownership.
12. Key-request rejection/cancellation procedure and incident-resolution authority.
13. Who may transition approved bookings to IN_USE, COMPLETED, or NO_SHOW.
14. Whether Priority Users may override class schedules or Admin-defined allocations. Current behavior fails safely.
15. Which roles receive `KEY_DIRECT_USE` beyond Admin.

Seeded rule values are labeled PROVISIONAL and are not automatically treated as finalized policy.
