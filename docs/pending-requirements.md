# Pending requirements

The following need product-owner decisions before enforcement:

1. University account integration and SSO provider.
2. External-user eligibility, verification, and sponsoring organization policy.
3. Maximum bookings per user/day.
4. Whether the confirmed three-day advance limit means calendar days or an exact rolling duration (implemented provisionally as exact duration).
5. No-show detection and penalties.
6. History/audit retention and legal requirements.
7. Report/export formats.
8. Sunday staffing and exceptional-holiday policy; Saturday is confirmed closed and the general window is 08:30–17:30.
9. Whether housekeepers need a separate authenticated role; permanently assigned keys are excluded from loan tracking.
10. Teacher-specific presentation and delegation rules beyond the confirmed class-derived key permission shared with Students.
11. Recurring schedule source/format and occurrence expansion ownership.
12. Key-request rejection/cancellation procedure and incident-resolution authority.
13. Who may transition approved bookings to IN_USE, COMPLETED, or NO_SHOW.
14. Whether Priority Users may override class schedules or Admin-defined allocations. Current behavior fails safely.
15. Which roles receive `KEY_DIRECT_USE` beyond Admin.

Seeded rule values are labeled PROVISIONAL and are not automatically treated as finalized policy.
