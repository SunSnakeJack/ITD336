# Key flow

For S2407–S2412, `get_room_slot_permissions` is the single decision boundary used by the room dialog. During an active class occurrence, every authenticated Student may create an auto-approved class key request; Teacher is intentionally supported by the same database rule for later UI reuse. This rule does not depend on enrollment data. Without a class, the user must own an approved room booking before requesting a key. Another user's booking never grants key permission.

An auto-approved request is permission to receive a key, not proof of physical handover. S2407–S2412 currently have no tracked `room_keys` seed records, so an Admin must configure physical copies before CHECKED_OUT inventory can be assigned. Booking-derived key requests remain REQUESTED until staff approval.

The borrower can call `confirm_key_return`, producing RETURN_REPORTED with actor/time history. The key becomes RESERVED until independent verification, so user confirmation is not represented as physical proof. A borrower can report damage only for their own checked-out physical key; the database records the incident and damage transition. Admin verification remains responsible for the final operational reconciliation.

For a CHECKED_OUT or LATE loan, the borrower may report LOST or DAMAGED through `report_key_issue`; ownership and transition validity are checked in the database. Admin assigns an AVAILABLE physical `room_keys` record when handing over an APPROVED request.

Row locks plus partial unique indexes prevent double checkout. All transitions append history and critical events append audit records. Rejection/cancellation of key requests and incident/compensation-specific RPCs remain future operational additions once exact procedures are confirmed.
