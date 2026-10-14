# Architecture

The browser authenticates with Supabase Auth using the anon key. `profiles.id` mirrors `auth.users.id`; no passwords are stored in application tables. Catalog reads and user-owned records pass through RLS. Mutating operational state uses transactional `security definer` RPCs with a fixed empty `search_path`, explicit qualification, permission checks, row locks, and audit/history writes.

Permissions are additive: users have many roles and roles have many permissions. V2 separates read-only `STAFF`, narrow `PRIORITY_USER`, and administrative `ADMIN`. University identity can later map a verified provider subject to a profile without allowing self-assigned roles.

Availability checks three sources: approved/in-use bookings, concrete teaching schedule occurrences, and room blocks. An exclusion constraint is the final race-safe barrier against overlapping approved bookings; an advisory transaction lock serializes availability approval/creation decisions per room. All persisted instants use `timestamptz`; clients display them in Asia/Bangkok.

Notifications are stored with IN_APP and EMAIL delivery queue rows. No provider is wired in this phase. A trusted Edge Function/server can later claim EMAIL rows. Supabase Storage is ready for later use but no bucket is created because no confirmed document workflow exists.

## Known technical boundaries

- `class_schedules.recurrence_rule` preserves a future iCalendar rule, but availability only checks concrete `starts_at`/`ends_at` occurrences. A schedule import/expansion process is required before recurring rules are activated.
- Confirmed V2 booking limits are configuration-backed; the calendar-day versus exact-duration meaning of three days remains explicitly pending.
- Critical booking/key transitions are RPC-only. Staff has read-only operational permissions; Admin holds management permissions.
- See `requirements-v2-schema.md` for the incremental target schema and unresolved decisions.
