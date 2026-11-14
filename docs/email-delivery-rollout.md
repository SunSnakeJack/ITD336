# Additional email rollout

Confirmed requirements: reminders 30 minutes before start; admin recipients are
active profiles assigned ADMIN; cancellation goes only to the requester for now.
Priority displacement email delivery remains out of scope pending confirmed rules.

0067 adds future key-request start reminders, pending-approval admin notices,
and overdue polling for outstanding APPROVED/IN_USE requests. Overdue polling
uses a one-day recovery window to avoid historical backlog; this is an operational
assumption, not a no-show penalty. Terminal transitions cancel pending start reminders.
0068 adds booking submission/status/start-reminder events and a server-only context RPC.
No historical submission or admin-notice backfill is performed.

The production worker requires RESEND_FROM to be ITD336 <noreply@itd336.app>,
ITD336_RESEND_API_KEY, and a scheduler bearer matching CRON_SECRET.
Migration 0071 adds a service-only claim restricted to supported templates
created and scheduled at or after EMAIL_PRODUCTION_START_AT. Use an explicit
UTC cutover time and keep it fixed. Older rows remain in the database.
Each production row is claimed once. Provider idempotency keys provide an
additional safeguard. Reconcile uncertain outcomes with Resend before any
manual recovery. Outgoing emails contain no action links or Gmail markup.
Overdue polling and Priority displacement are excluded from production claims.
Keep the scheduler inactive until Vault is configured and the SQL is verified.
Never expose CRON_SECRET, Resend keys, or service-role keys to frontend code.

Before activation:
1. Review/apply migrations to the explicitly authorized project, regenerate types.
2. Verify RPC authorization and email event creation with test users.
3. Review stale pending outbox items before enabling broad delivery. Do not bulk-send them.
4. Deploy worker only after migrations; configure verified sender.
5. Configure a one-minute scheduler POST to email-worker with Bearer CRON_SECRET.
   Store the secret in Vault or the scheduler's secret store, never in migration SQL.
   The linked project's job was inactive and both Vault entries were absent.
6. Confirm provider delivery and inbox receipt for every new event.

Database checks: NOT RUN — AUTH TEST USERS REQUIRED.
## Rollback

Disable the `itd336-email-worker` cron job first. Set
`EMAIL_DELIVERY_MODE=disabled` to reject dispatches while investigating.
Requests already handed to Resend can still complete. Keep the cutoff and
outbox records intact. Reconcile any leased or failed row against Resend before
considering manual recovery. Resume only with the original cutoff and after
checking which new messages accumulated during the stop.

For production, rotate CRON_SECRET during setup and put the same new value in
Vault. This isolates the scheduler from previous test credentials.
