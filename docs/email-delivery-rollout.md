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

Current blocker: no verified Resend sender domain. Keep EMAIL_DELIVERY_MODE=test.
Production requires a Resend-verified RESEND_FROM and EMAIL_DELIVERY_MODE=production.
The production worker accepts only CRON_SECRET-authenticated calls. Never expose
CRON_SECRET, Resend keys, or service-role keys to frontend code.

Before activation:
1. Review/apply migrations to the explicitly authorized project, regenerate types.
2. Verify RPC authorization and email event creation with test users.
3. Review stale pending outbox items before enabling broad delivery. Do not bulk-send them.
4. Deploy worker only after migrations; configure verified sender.
5. Configure a one-minute scheduler POST to email-worker with Bearer CRON_SECRET.
   Store the secret in Vault or the scheduler's secret store, never in migration SQL.
   No cron.job table was present during the read-only cloud check.
6. Confirm provider delivery and inbox receipt for every new event.

Database checks: NOT RUN — AUTH TEST USERS REQUIRED.
No migration, scheduler, production mode, or broad email delivery activated by this change.
