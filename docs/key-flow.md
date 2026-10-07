# Key flow

Approved booking requiring a key → `request_key` → REQUESTED → staff `approve_key_request` → APPROVED → staff `checkout_key` assigns an AVAILABLE physical copy → CHECKED_OUT → staff `return_key`.

A normal on-time return becomes RETURNED and the key becomes AVAILABLE. A normal late return becomes LATE, creates a LATE_RETURN incident, and releases the key. DAMAGED or LOST returns update both loan and key status and create an incident. Compensation can be assessed later, marked PAID, and the incident resolved without redesign.

Row locks plus partial unique indexes prevent double checkout. All transitions append history and critical events append audit records. Rejection/cancellation of key requests and incident/compensation-specific RPCs remain future operational additions once exact procedures are confirmed.
