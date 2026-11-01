# Milo pack admin status

The user requested this bounded fix after a Milo credit pack appeared as Needs review. Implementation is authorized; this document records the supplied scope without reopening a design decision. PR #592 remains frozen and is incorporated from main only after delivery.

## Intent and behavior

Recognize a Milo pack receipt by its existing billing product `studio_assistance_pack` **or** the exact legacy job reference prefix `studio-sol-pack:`. A pack purchase is a recorded product transaction, not a missing media job. Name it **Milo credit pack** in the amount/details presentation, retain the canonical Charge entry type and recorded amount, and show its reference as plain text rather than a media-job link. Product identity takes precedence over incidental media origin flags.

Pack receipts must not advertise the media **Refund tokens** action (`canRefund=false`). Existing server refund protection remains unchanged. Positive pack receipts are excluded from missing-job review, including the server-side Needs review filter. A zero/negative charge remains an anomaly even when it is a pack. Genuine missing media jobs and valid media refunds retain their current behavior.

## Approach

Reuse one browser-safe identity helper from the existing transaction-review owner and project the stored billing product into the admin read DTO. Read the optional historical column through `to_jsonb(r)` to preserve the existing older-schema reader contract. Apply the equivalent identity predicate before history pagination. This is the implementation choice; changing ledger data, manufacturing a media job or weakening refund endpoints would violate the requested scope.

## Constraints and validation

No credits, ledger writes, migrations, cron, provider, timeout or server refund command changes. No real customer identity or production access, and no attempted refund. Tests use synthetic receipts, rendered admin output and disposable local PostgreSQL. Cover product-only identity, prefix-only historical identity, misleading descriptions/lookalike prefixes, nonpositive pack anomalies, history pagination and unchanged real media eligibility/display.
