# Architecture

The browser authenticates with Supabase Auth using the anon key. `profiles.id` mirrors `auth.users.id`; no passwords are stored in application tables. Catalog reads and user-owned records pass through RLS. Mutating operational state uses transactional `security definer` RPCs with a fixed empty `search_path`, explicit qualification, permission checks, row locks, and audit/history writes.

Permissions are additive: users have many roles and roles have many permissions. V2 separates read-only `STAFF`, narrow `PRIORITY_USER`, and administrative `ADMIN`. University identity can later map a verified provider subject to a profile without allowing self-assigned roles.

Availability checks three sources: approved/in-use bookings, concrete teaching schedule occurrences, and room blocks. An exclusion constraint is the final race-safe barrier against overlapping approved bookings; an advisory transaction lock serializes availability approval/creation decisions per room. All persisted instants use `timestamptz`; clients display them in Asia/Bangkok.

The schedule UI follows `component → query → service → Supabase RPC`. Admin schedule mutations use permission-checked database functions; students and administrators share the same privacy-aware weekly event feed. The feed expands weekly academic schedules only for the requested date range and combines them with approved bookings and room blocks.

The shared floor-plan geometry is frontend configuration in `src/features/rooms/room-map.config.ts`; room entries resolve by the immutable database `layout_key` and navigate with the room UUID. The user-facing room code may therefore be edited without disconnecting the room from its floor-plan position. Reference spaces such as corridors, stairs, and lifts remain non-interactive. Active rooms are selectable by guests and administrators; inactive rooms remain visible but disabled for guests while administrators can open their management detail. Room names, operational state, capacity, and schedule data remain in Supabase.

Admin room management reuses the floor map and room-detail presentation. Availability changes use the permission-checked `set_room_availability` RPC, update booking availability consistently, and append an audit event. Admin room schedules use a Monday-through-Sunday calendar week; the public room view uses a navigable Sunday-through-Saturday week.

Admin users can create a recurring academic schedule directly from an empty calendar cell and edit the whole recurring record from an occupied class cell. The selected academic term supplies the effective start/end dates and academic labels. Class events use the same schedule feed for Admin and guest rendering. Saturday is the confirmed weekly closure, is rendered as a holiday, and is rejected for active academic schedules by a database trigger.

The public room detail disables past, Saturday, and post-limit slots while retaining them as schedule context. Occupied class cells remain selectable so the database can offer class-derived key permission while refusing another booking. Identity always comes from `auth.uid()`. Guests are redirected to `/login`. Admin schedule deletion is a soft deactivation through the existing permission-checked RPC. Schedules may use either a configured academic term or an explicitly entered custom teaching range.

The temporary public booking and key actions redirect to `/login`; they do not create records. Before an Admin schedule save, an authorized conflict lookup produces a localized message naming the weekday, existing subject, and time range. The mutation RPC repeats the conflict check transactionally to protect against races.

The Admin room calendar defaults to a Monday-through-Sunday empty grid until a room is selected. On a room detail page, an empty slot first asks whether the Admin is adding an academic schedule or an external-party booking. External bookings use the permission-checked `create_external_booking` RPC and render as pastel-blue booking events. Room metadata changes use one audited RPC rather than direct table updates.

An Admin may reopen an approved external-party booking from its calendar cell and edit it through a controlled RPC. Exact-time availability checks expand recurring academic schedules for every requested Bangkok date, so both new and edited external bookings are rejected when they overlap a class occurrence, another active booking, or a room block.

The public application shell shows the room overview. Authenticated users receive a combined booking/key workspace with inner tabs plus a usage-history placeholder. Guest room actions redirect to `/login`; authenticated users receive a permission-aware room-booking or key-request form. An Admin can approve or reject pending room bookings and can soft-cancel an external-party booking through controlled lifecycle RPCs.

The room overview is one shared schematic component for Guest, User, and Admin; room identity and availability come from the catalog while geometry remains stable frontend configuration. Guest room booking opens the full login route, whereas guest key access uses the same credential form inside an accessible modal and re-evaluates permission after authentication.

The Admin usage-policy page selects one room and configures a Guest/Student permission matrix. Student is the only authenticated role configurable in this phase; Teacher and Priority retain their existing behavior until a later confirmed expansion. Updates pass through a `SETTINGS_MANAGE` RPC, write an audit event, and are enforced again by database functions and triggers. The Admin key-cabinet page is read-only and derives green available, yellow checked-out, and red closed states from current room, physical-key, and active-loan data.

Key return is borrower-operated and completes immediately without an Admin verification step. Checkout remains race-safe at the database boundary: a room-level transaction lock and trigger permit only one `CHECKED_OUT` or `LATE` holder per room, while lost or damaged reports keep the key unavailable for operational follow-up.

Booking approval is the only Admin approval boundary in the Student booking/key flow. An eligible booking-derived key request is automatically `APPROVED`; the borrower records checkout and return themselves, while Admin key screens remain read-only operational monitoring.
The public sidebar now uses the room overview as its single catalog entry; `/rooms` is retained only as a compatibility redirect. Admin navigation includes a booking inbox backed by the RLS-protected booking details view.

Authenticated screens subscribe to Supabase Realtime changes for rooms, schedules, bookings, key loans, and key incidents. These events invalidate TanStack Query caches, so an Admin approval or operational update is fetched into the user's open screen without a manual reload. Realtime publication membership is migration-managed; reconnect/focus refetch remains the fallback.

The authenticated header also subscribes to the user's RLS-filtered notifications. Its unread badge is cleared through ownership-checked, security-definer `mark_notification_read` and `mark_all_notifications_read` RPCs; clients never receive permission to update another user's notification. Schedule booking ownership is returned as a boolean only, allowing green self-booking cells without exposing another user's identity.

The room directory and room-detail routes are public. Guests read only through dedicated `security definer` catalog and schedule RPCs; they receive active room metadata, class occupancy, generic booking occupancy, and generic room-block occupancy. Direct anonymous table access remains disabled. Authentication is isolated at `/login`, while `/admin/*` retains an explicit role guard.

Notifications are stored with IN_APP and EMAIL delivery queue rows. No provider is wired in this phase. A trusted Edge Function/server can later claim EMAIL rows. Supabase Storage is ready for later use but no bucket is created because no confirmed document workflow exists.

## Known technical boundaries

- Academic schedules use explicit weekday, local start/end time, and effective date ranges. They also retain `starts_at`/`ends_at` and `recurrence_rule` for compatibility with existing availability code. Migration `0008` introduces conflict checks for recurring academic schedules against schedules, approved/in-use bookings, and room blocks.
- Confirmed V2 booking limits are configuration-backed; the calendar-day versus exact-duration meaning of three days remains explicitly pending.
- Critical booking/key transitions are RPC-only. Staff has read-only operational permissions; Admin holds management permissions.
- See `requirements-v2-schema.md` for the incremental target schema and unresolved decisions.
