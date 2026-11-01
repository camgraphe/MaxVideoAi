# Milo response focus ownership

Authorized scope: stop a new assistant message from taking focus away from a
setting, reader control or another interaction. Preserve useful keyboard focus
for explicitly sending a message. No provider, billing, menu-closing policy,
application proof, model selection or saved draft behavior changes.

The panel currently focuses Message Milo for every appended assistant reply.
CoreSettingsBar uses SelectMenu, whose outside focusin handler closes its menu.
That is a reproducible source mechanism. A closed live trace is consistent with
it but does not instrument the causal focus event; no live replay is required.

Chosen minimal design: move the existing focus call to the synchronous Send
gesture, before onSend, for both button and Enter. Message input stays focusable
while pending. The asynchronous reply keeps transcript/proposal presentation
updates and does not claim focus. This avoids guessing whether body focus came
from a disabled Send button or from a later intentional interaction. A panel-wide
contains guard would still steal focus from other controls inside the panel.

Verification: real Panel, CoreSettingsBar/SelectMenu and CSS in Chromium/WebKit;
controlled synthetic completion while Audio/Duration is open; internal and
external focus retained; input Enter and keyboard activation of Send still useful
before and after completion. Existing keyboard/form guard remains covered.
Local tests prove this mechanism, not attribution of the earlier live incident.
