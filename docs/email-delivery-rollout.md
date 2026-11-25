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

0090 limits meeting-room email to automatic confirmation at creation, cancellation,
and the start reminder. The production claim excludes queued pending-submission,
approval, and rejection messages. Key-request email events use the existing
rules. Deploy the email worker to enable the shared Thai date and time format.

The production worker sends as IT KeySpace <noreply@itd336.app>. RESEND_FROM
also accepts the previous ITD336 display name during rollout. The worker requires
ITD336_RESEND_API_KEY, and a scheduler bearer matching CRON_SECRET.
The web form uses the request RPC result. The RPC queues notifications and
the production scheduler dispatches them. To opt into direct scoped test delivery,
use a development build with VITE_EMAIL_TEST_DISPATCH=true and the worker
configured in test mode. The worker still enforces its test recipient and scope.
Migration 0071 adds a service-only claim restricted to supported templates
created and scheduled at or after EMAIL_PRODUCTION_START_AT. Use an explicit
UTC cutover time and keep it fixed. Older rows remain in the database.
Each production row is claimed once. Provider idempotency keys provide an
additional safeguard. Reconcile uncertain outcomes with Resend before any
manual recovery.
Migration 0099 adds request edits, special-room expiry, overdue key returns,
and priority replacement to production delivery. New events go to the
requester affected by the change. Deadline events are deduplicated per request
and only consider deadlines in the last day and at or after the production cutoff.

Migration 0121 adds a separate start-time email for approved or in-use bookings
and key requests. The worker queues it once per request for starts in the last
five minutes and rechecks eligibility before sending. The 30-minute reminder
uses its existing schedule.

New emails use a stable subject per request and show the event title in the body.
The worker uses a shared References value scoped to the request and recipient.
When the Resend key can retrieve a previous email with the same subject, the
worker also references its Message-ID. Conversation grouping is controlled by
the receiving mail client.

Key-request submission, approval, and start reminder emails can include a
cancellation link for the requester before the start time. Set PUBLIC_SITE_URL
to the HTTPS origin of the user-facing application. Apply migration 0122 before
deploying the worker. The link opens the existing authenticated history page and
requires confirmation there. The worker does not issue email action tokens.
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

## Diagnosing delivery failures

| Signal | Check |
| --- | --- |
| Key-request RPC fails | Inspect the RPC response for validation, time conflicts, or authorization. An unsuccessful RPC does not establish that a notification was queued. |
| Worker responds 400 or 405 | Check the entity dispatch arguments for a scoped test, or check that the scheduler used POST. |
| Worker responds 403 | Check the mode, scheduler authorization and cutover, or the permitted test entity and batch scope. |
| Worker responds 503 | Check the delivery mode, sender, approved test recipient and worker configuration. |
| Worker responds 500 | Check the claim RPC error and database permissions. |
| Worker responds 200 with failed rows | Check outbox errors for recipient validation, context lookup, stale timed notifications, provider errors and network timeouts. Check Edge Function logs for completion RPC failures. |

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
