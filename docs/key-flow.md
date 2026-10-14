# Key flow

`borrow_key` supports an approved Booking, an active Class Schedule, or permission-gated Direct Usage. It assigns an AVAILABLE tracked physical copy and records CHECKED_OUT atomically without human approval. The old request/approval RPC remains compatible for older clients but is no longer the primary V2 workflow.

The borrower can call `confirm_key_return`, producing RETURN_REPORTED with actor/time history. The key becomes RESERVED until independent verification, so user confirmation is not represented as physical proof. Admin verification finalizes RETURNED/LATE/DAMAGED/LOST and updates inventory/incidents.

Row locks plus partial unique indexes prevent double checkout. All transitions append history and critical events append audit records. Rejection/cancellation of key requests and incident/compensation-specific RPCs remain future operational additions once exact procedures are confirmed.
