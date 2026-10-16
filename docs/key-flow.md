# Key flow

For S2407–S2412, `get_room_slot_permissions` is the single decision boundary used by the room dialog. During an active class occurrence, every authenticated Student may create an auto-approved class key request; Teacher is intentionally supported by the same database rule for later UI reuse. This rule does not depend on enrollment data. Without a class, the user must own an approved room booking before requesting a key. Another user's booking never grants key permission.

An auto-approved request is permission to receive a key, not proof of physical handover. S2407–S2412 currently have no tracked `room_keys` seed records, so an Admin must configure physical copies before CHECKED_OUT inventory can be assigned. Booking-derived key requests remain REQUESTED until staff approval.

The borrower completes a normal return through `report_key_status` without waiting for an Admin. The loan becomes `RETURNED`, an assigned physical key becomes `AVAILABLE`, and history/audit evidence retains the responsible actor and time. Lost or damaged reports remain terminal unavailable states for operational follow-up.

For a CHECKED_OUT or LATE loan, the borrower may report LOST or DAMAGED through `report_key_issue`; ownership and transition validity are checked in the database. Admin assigns an AVAILABLE physical `room_keys` record when handing over an APPROVED request.

Row locks plus partial unique indexes prevent double checkout. All transitions append history and critical events append audit records. Rejection/cancellation of key requests and incident/compensation-specific RPCs remain future operational additions once exact procedures are confirmed.

Migration `0021_user_reported_key_status_and_notification_reads.sql` introduced borrower lifecycle reporting and the intermediate `RETURN_REPORTED` state. Migration `0024_self_service_key_return.sql` supersedes that intermediate normal-return behavior: new borrower returns complete directly as `RETURNED`, while every action still writes history and an audit event. Room-level loans may be recorded before a physical `room_keys` copy is configured, while incidents still retain the responsible loan and user.

Migration `0023_room_permission_matrix_and_key_availability.sql` makes Student key eligibility configurable per room. A booking-derived request and its transition to `CHECKED_OUT` are both rejected before the booking's Bangkok calendar date; the account UI mirrors that rule by disabling the checkout action and displaying the first available date. This keeps the database authoritative even if a client bypasses the interface.

Migration `0024_self_service_key_return.sql` changes the confirmed operational model to borrower self-service. A borrower return completes as `RETURNED` immediately and releases an assigned physical key to `AVAILABLE`; no Admin receipt confirmation is required. Checkout is serialized with a room-level advisory lock and rejects a second `CHECKED_OUT`/`LATE` holder for the same room. Lost and damaged keys remain unavailable and retain incident/audit evidence.

Migration `0025_self_service_booking_key_approval.sql` removes Admin approval from booking-derived key requests. Once the room booking is approved and the Bangkok booking date has arrived, an eligible borrower request is created as `APPROVED` immediately and the borrower can confirm `CHECKED_OUT` themselves. The Admin key list is operational monitoring only; booking approval remains the sole Admin approval step.

Migration `0028_overdue_key_cabinet_and_borrower_identity.sql` distinguishes an active in-period checkout (`CHECKED_OUT`, yellow) from a key that remains held after `expected_return_at` (`OVERDUE`, red). A closed room is gray; an overdue holder takes visual precedence so an outstanding key cannot be hidden by room availability. The Admin activity view also exposes the borrower's profile name and university id, with email/system id reserved as UI fallbacks.
