# Milo independent creative briefs

Date: 2026-10-30. Authorized as part of the Milo stabilization corrections.

## Intent

Starting a new creative brief must not silently inherit the subject of an old
manual prompt or unapplied proposal. The latest message and relevant conversation
establish whether the user is creating another idea or revising existing text.
Merely having text in the editor does not establish that intent.

## Approach

Correct the shared composer provider instructions. Keep the editor and proposal
as separate context, but remove the rule that automatically uses the editor when
no active suggestion exists. Resolve intent from meaning and conversation across
languages, without client-side keyword routing. An independent brief stands on
its own even when an active suggestion exists. When an initial creative request
with a nonempty editor leaves reuse-versus-new intent unclear, ask one concise
question in the user's language: work from the current prompt or start a new one.
The question may briefly name the current prompt's topic to explain the choice.
Return `text: null` until that choice is clarified. Explicit editor revisions and
explicit independent new briefs proceed directly. Honor the user's answer through
conversation and do not repeat the question once the choice is clear.

For a clear revision or natural continuation, the latest unapplied suggestion
remains the usual working text. An explicit reference to the manual editor uses
that editor instead. A continuation can be clear from conversation without an
explicit revision command. Keep the existing unresolved-referent and current
settings rules.

Clearing or withholding the editor on New chat would break the approved physical
editor behavior and explicit editor revisions. A phrase classifier would add
language-dependent ambiguity before the assistant sees the conversation. Neither
is needed for this correction.

## Boundaries and verification

No request schema, browser storage, New chat, settings, billing or generation
behavior changes. New chat still preserves the manual editor, references and
settings. Studio retains its separate conversation owner.

Synthetic provider-boundary cases cover independent briefs with and without an
active suggestion, underspecified style-only intent, the clarification followed by
new-idea and reuse answers in different languages, explicit editor revision,
proposal follow-up and natural conversation continuation. These local tests check
the actual outgoing policy and separated context; they do not claim model-output
quality. Keep private reported prompts out of source control. No provider calls
are part of this implementation; corrective output evaluation is coordinated
separately before release.
