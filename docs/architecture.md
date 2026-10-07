# Architecture

The browser authenticates with Supabase Auth using the anon key. `profiles.id` mirrors `auth.users.id`; no passwords are stored in application tables. Catalog reads and user-owned records pass through RLS. Mutating operational state uses transactional `security definer` RPCs with a fixed empty `search_path`, explicit qualification, permission checks, row locks, and audit/history writes.

Permissions are additive: users have many roles and roles have many permissions. Application logic checks permission codes rather than role names, so roles such as housekeeper can be introduced without schema changes.

Availability checks three sources: approved/in-use bookings, concrete teaching schedule occurrences, and room blocks. An exclusion constraint is the final race-safe barrier against overlapping approved bookings; an advisory transaction lock serializes availability approval/creation decisions per room. All persisted instants use `timestamptz`; clients display them in Asia/Bangkok.

Notifications are stored with IN_APP and EMAIL delivery queue rows. No provider is wired in this phase. A trusted Edge Function/server can later claim EMAIL rows. Supabase Storage is ready for later use but no bucket is created because no confirmed document workflow exists.

## Known technical boundaries

- `class_schedules.recurrence_rule` preserves a future iCalendar rule, but availability only checks concrete `starts_at`/`ends_at` occurrences. A schedule import/expansion process is required before recurring rules are activated.
- Booking rule rows are provisional configuration. RPC enforcement is intentionally limited to confirmed invariants; uncertain limits are not silently treated as policy.
- Direct operational table writes remain available only where staff RLS and grants allow normal administration. Critical booking/key transitions are RPC-only.
