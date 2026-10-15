# Architecture

The browser authenticates with Supabase Auth using the anon key. `profiles.id` mirrors `auth.users.id`; no passwords are stored in application tables. Catalog reads and user-owned records pass through RLS. Mutating operational state uses transactional `security definer` RPCs with a fixed empty `search_path`, explicit qualification, permission checks, row locks, and audit/history writes.

Permissions are additive: users have many roles and roles have many permissions. V2 separates read-only `STAFF`, narrow `PRIORITY_USER`, and administrative `ADMIN`. University identity can later map a verified provider subject to a profile without allowing self-assigned roles.

Availability checks three sources: approved/in-use bookings, concrete teaching schedule occurrences, and room blocks. An exclusion constraint is the final race-safe barrier against overlapping approved bookings; an advisory transaction lock serializes availability approval/creation decisions per room. All persisted instants use `timestamptz`; clients display them in Asia/Bangkok.

The schedule UI follows `component → query → service → Supabase RPC`. Admin schedule mutations use permission-checked database functions; students and administrators share the same privacy-aware weekly event feed. The feed expands weekly academic schedules only for the requested date range and combines them with approved bookings and room blocks.

The shared floor-plan geometry is frontend configuration in `src/features/rooms/room-map.config.ts`; room entries resolve by stable database room code and navigate with the room UUID. Reference spaces such as corridors, stairs, and lifts remain non-interactive. Active rooms are selectable by guests and administrators; inactive rooms remain visible but disabled for guests while administrators can open their management detail. Room names, operational state, capacity, and schedule data remain in Supabase.

Admin room management reuses the floor map and room-detail presentation. Availability changes use the permission-checked `set_room_availability` RPC, update booking availability consistently, and append an audit event. Admin room schedules use a Monday-through-Sunday calendar week; the public room view retains its rolling seven-day range.

Admin users can create a recurring academic schedule directly from an empty calendar cell and edit the whole recurring record from an occupied class cell. The selected academic term supplies the effective start/end dates and academic labels. Class events use the same schedule feed for Admin and guest rendering. Saturday is the confirmed weekly closure, is rendered as a holiday, and is rejected for active academic schedules by a database trigger.

The public room detail intentionally hides calendar navigation and treats every visible cell as an action target. Its temporary action dialog exposes non-functional booking and key-request affordances without bypassing any backend workflow. Admin schedule deletion is a soft deactivation through the existing permission-checked RPC. Schedules may use either a configured academic term or an explicitly entered custom teaching range.

The room directory and room-detail routes are public. Guests read only through dedicated `security definer` catalog and schedule RPCs; they receive active room metadata, class occupancy, generic booking occupancy, and generic room-block occupancy. Direct anonymous table access remains disabled. Authentication is isolated at `/login`, while `/admin/*` retains an explicit role guard.

Notifications are stored with IN_APP and EMAIL delivery queue rows. No provider is wired in this phase. A trusted Edge Function/server can later claim EMAIL rows. Supabase Storage is ready for later use but no bucket is created because no confirmed document workflow exists.

## Known technical boundaries

- Academic schedules use explicit weekday, local start/end time, and effective date ranges. They also retain `starts_at`/`ends_at` and `recurrence_rule` for compatibility with existing availability code. Migration `0008` introduces conflict checks for recurring academic schedules against schedules, approved/in-use bookings, and room blocks.
- Confirmed V2 booking limits are configuration-backed; the calendar-day versus exact-duration meaning of three days remains explicitly pending.
- Critical booking/key transitions are RPC-only. Staff has read-only operational permissions; Admin holds management permissions.
- See `requirements-v2-schema.md` for the incremental target schema and unresolved decisions.
