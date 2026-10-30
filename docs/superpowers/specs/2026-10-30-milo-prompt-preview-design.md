# Compact Milo prompt preview

Approved by Adrien on 2026-10-30 after reviewing the compact interactive mockup.

Show the beginning of Milo's actual suggestion with an ellipsis in the existing
53 px proposal bar. Keep the current quiet appearance, Apply action, stale and
length guards, and existing review surface and editor. The excerpt and the eye
button both open that review surface; the excerpt does not apply the suggestion.
Use `View prompt` rather than `Review`, with matching script/lyrics and FR/ES copy.
Keep the 44 px touch targets; truncate the excerpt as space shrinks. If narrow
translated controls leave insufficient room, retain the eye button's accessible
label while hiding its visible text. Preserve the fixed conversation geometry.

Considered: a two-line bar, an artifact card and a clickable compact field.
Adrien selected the bar for its existing aesthetic and minimal footprint, then
approved the 53 px version. The other options require more visual separation.

Deliver as a separate follow-up to PR #563; do not change that release branch.
No API, assistant-context, generation, billing or review-navigation change.
