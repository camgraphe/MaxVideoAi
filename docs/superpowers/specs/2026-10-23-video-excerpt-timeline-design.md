# Visual excerpt timeline

The user rejected the two disconnected native sliders as rudimentary and asked
for established timeline/handle interactions. This is a visual and interaction
revision of the already authorized shared excerpt feature, staying local.

References inspected: Apple Photos trim (https://support.apple.com/en-ca/104968)
uses two handles on a single video timeline and selection playback; Clipchamp
(https://support.microsoft.com/en-us/clipchamp/stream-pages/how-to-trim-videos-in-microsoft-clipchamp-s-video-player)
combines timeline handles with optional precise start/end entry. We adopt that
interaction, not their persistence semantics or a full multitrack editor.

## Design

Replace two separate range rows with one compact filmstrip below a larger video
stage. Gold bounds identify the kept interval; excluded areas are dimmed. A thin
contrasting playhead shows the preview position. Pointer/touch handles resize the
range, dragging the selected body moves it without changing length, and a track
seek surface/playhead scrubs the preview. Clearly distinguish handles from the
playhead. Keep exact numeric start/end editing in a compact row, with duration
prominent. Provide explicit Play/Pause and current/source time, plus a reset to
the exact whole-video range. A focus-selection/full-view zoom affordance makes
short excerpts on a long source usable on mobile, without changing selection.

Use the existing app tokens, typography, accessible modal, EN/FR/ES copy and
lucide icons. Desktop dialog max around 720px, responsive to 320px, bounded
viewport height with usable actions. All touch targets at least 44px where
practical; keyboard slider semantics, arrow fine/coarse steps, Home/End, visible
focus and original Apply/Cancel/Escape focus behavior remain.

The filmstrip contains actual frames, never fake imagery. Sample at most 10 small
frames (160px wide) from the existing owned preview after explicit playback or
scrubbing intent. Do not eagerly fetch source video on opening the dialog. Use
one temporary decoder, cancellation and bounded time; release media/resources
on source change/unmount. If capture/CORS is unavailable, keep the numbered time
track and preview working, without a blocking error or new backend endpoint.

## Contracts

No backend, upload, storage, model, price, prepared-asset or ownership changes.
Keep VideoExcerptSelectorProps and callbacks unchanged. No silent truncation;
invalid model durations remain visible and cannot Apply. Full fractional source
duration is exact; pointer rounding must not prevent restoring the original.
Requested output duration remains independent. Opening and editing cannot prepare
media or generate. No push, deployment, production mutation or paid render.

## Verification

Use actual product UI with existing phone and minute fixtures at desktop and
390/320px mobile. Exercise pointer/touch/keyboard, resize/move/seek/reset/zoom,
invalid ranges, measured Apply/price lifecycle and successful focus return. Test
thumbnail capture failure/cancel/no initial media fetch. Reuse existing lifecycle
tests rather than repeat unchanged backend/encoding qualification. Show local
screenshots and leave the functioning demo open.
