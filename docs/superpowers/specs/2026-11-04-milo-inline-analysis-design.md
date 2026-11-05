# Reference analysis inside Milo

## Intent and approved direction

Adrien asked for reference analysis to happen inside the assistant conversation, without asking customers to find another control. The November 4 audit showed repeated requests to analyze attached video/audio ending in metadata-only explanations without an actionable handoff. He authorized work on this and the other diagnosed failures, with production delivery through the established GitHub process.

## Experience

Milo can recommend a particular attached reference, modality and interval in its response. A compact card in the transcript lets the customer review the selected excerpt, obtain its credit ceiling, explicitly confirm, follow progress and read the result. Customers can also open the same card themselves. This replaces the separate analysis dialog and does not enlarge the composer when inactive.

Images keep their existing automatic perception path. Video visuals are sampled across at most 12 frames/60 seconds; audio covers at most 30 seconds and approximate timing. The card explains this coverage without claiming exhaustive viewing or exact choreography. Lite keeps its references and offers the existing settings entry for choosing an eligible level.

The existing analysis hook/service remains the only execution and credit owner. Preparing a quote does not dispatch a paid analysis. Confirmation is explicit. Completion offers an explicit continuation in the chat using saved observations; it must not silently send another billable writing request or overwrite an unsent message. Multiple references can be inspected successively.

## Safety and compatibility

- Recommendations contain structured reference identity, never a URL. They are validated against the current owned context and cannot execute tools themselves.
- Preserve versioned provider decoding and all historical reply recovery.
- Changing a reference, interval, draft or level invalidates the quote. A stale recommendation cannot silently target a new asset occupying the same slot.
- Reload recovers paid work by GET, never another automatic paid POST. Account/workflow/new-chat boundaries remain intact.
- Existing prompt application, visible generation price, credits, refunds and reservation policy remain unchanged.
- Result coverage and charges remain visible; errors provide recovery rather than implying cancellation/refund.
- No customer identities, private URLs or conversation contents enter the repository.

## Approaches

1. Explain the existing external analysis button: insufficient for the requested in-chat flow.
2. Move a manual control into the transcript only: useful fallback, but still leaves model requests unconnected to actions.
3. Structured recommendation plus the existing confirmation lifecycle rendered in the transcript: selected because it makes the next step actionable while preserving financial and ownership boundaries.

## Separate diagnosed repairs

Private prepared audio needs the existing authorized provider-transport access mechanism in BytePlus. Resource-inaccessible failures must not be described as recognizable-person moderation. Credit admission must explain that remaining credits may be below the next request's reservation, and account support guidance should provide the real support entry. These are independently testable changes, integrated after review.

## Validation

Behavioral tests cover inline quote/confirm/result, stale selections, double clicks, restoration, account changes, Lite restrictions, continuation and preserved draft. Protocol tests cover old/new versions and invalid recommendations. Provider tests cover private signing and distinct error classification. Production delivery requires latest main, all selected Quality CI lanes, exact Git Preview qualification and both production domains aligned to the merge commit.
