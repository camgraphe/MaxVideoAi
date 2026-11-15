# Audio, Character Studio, creator tools and Studio

Read for a selected Audio, identity/look, Recast, subtitle, creator-tool or saved Studio operation. The exact quote, explicit approval and one-attempt rules in the skill apply to every workflow.

## Audio and sound

Read `list_audio_capabilities` before choosing voice, music, SFX, ambience, song
or a video soundtrack pack. Use only its current available mode and variant,
settings and owned `source_video` or `voice_sample` references. Some environments
expose only narration. Do not call that a lack of music support everywhere, or
substitute a provider, infer voice cloning, or invent a price.

Use `prepare_audio_generation` for the complete request. Show its exact price
and wait for explicit approval before `confirm_audio_generation`, once. Recover
the returned job with `get_generation_status` or `list_recent_generations` and
deliver a completed result with `present_generation`. Accepted or running means
the saved attempt is in progress. If it needs review or retry is null, stop
automatic polling and preserve that job; never repeat a paid submission.

## Character Studio and Recast

Use `list_saved_characters`, then `get_saved_character`, to choose an exact
identity and optional look. Resolve duplicate names with the user. Use
`select_saved_character` to obtain its owned original asset for another request.

When `prepare_character_builder` is exposed, use its structured recipe and owned
image asset IDs to quote a new identity or a look of the exact saved character.
Show the returned recipe, exact amount and expiry; wait for explicit approval
before `confirm_character_builder`. Recover that same quote through
`get_character_builder_status`, or read it with `get_character_builder_quote`.
Use `save_character` only on request and only for the completed Builder original.
A generic image does not become a Builder recipe by being called a character.
When direct authoring is unavailable, use the returned Builder web destination.

Recast uses `prepare_recast` with the exact identity/look or owned portrait and
explicit independent video/audio passages. Show the exact fresh quote and wait
for approval before `confirm_recast`. Recover its original quote using
`get_recast_status`; `get_recast_quote` reads existing terms without renewing or
approving them. A refund or reconnect never grants another attempt.

## Creator tools, subtitles and saved Studio cuts

Read `list_creator_tools` before preparing an operation. Use only open execution
profiles and available tools. A web-only tool uses its exact returned web
destination; never present opening the workbench as a completed operation.
Use `prepare_creator_tool` for a concrete owned source and supported profile,
then show the returned quote and wait for explicit approval before
`confirm_creator_tool`. A zero amount still requires that approval. Recover the
same operation with `get_creator_tool_operation` after an ambiguous response.

For captions, read `get_subtitle_document`, keep its revision and timing during
`edit_subtitle_document`, and export its text with `export_subtitle_text` when
requested. Text/style corrections and SRT/VTT sidecars do not retranscribe.
`prepare_subtitle_export` quotes burn-in from the exact saved document; follow
its actual returned price and approval contract. Do not describe all exports as
paid or included from memory. `prepare_studio_subtitles` uses the real saved
sequence mix, not a caller-created manifest or guessed media URL.

For a saved cut, `prepare_montage` plans caller-ordered ready clips and
`create_studio_montage` saves an editable project when available. Read
`get_studio_timeline` before `edit_studio_timeline`, preserve revisions and locks,
and reread on conflicts. Use `prepare_studio_export` for the exact saved cut,
wait for explicit approval, then `confirm_studio_export` once and recover with
`get_studio_export`. A reload, missing result or expired download never calls
for a new render. If that direct tool is not exposed, use a returned Studio web
destination and describe the remaining user action accurately.
