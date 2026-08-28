# MaxVideoAI for ChatGPT, Claude, and Codex

Plan and generate from ChatGPT, Claude, or Codex. Your assistant can develop the
creative brief, prompts, shot plan, and reference ideas for AI video or images
while MaxVideoAI provides current model facts, comparable project budgets, exact
quotes, generation, and job recovery.

In product language, MaxVideoAI is a ChatGPT app, a connector for Claude, and a
plugin for Codex. The remote MCP server is the shared technical connection.

## What it can do

- Recommend the strongest currently executable model for each shot and explain
  credible lower-cost alternatives.
- Budget a complete film with one model or a deliberate shot-by-shot mix.
- Validate prompts, settings, and private image, video, or audio references.
- Import private host attachments and compatible generated results directly as
  reusable MaxVideoAI assets, including ordered batches of up to eight files.
- Use a reviewed official provider prompting guide when one is available for
  the selected model, while keeping MaxVideoAI live details authoritative.
- Show the exact price and wait for explicit approval before generation.
- Track a job, present compatible results in the conversation, and recover
  completed or refunded outcomes without creating duplicate paid work.

## Workflow skills

- **`plan`** turns a creative brief into a live model shortlist and
  comparable, named project budgets. It is for deciding what to make and how
  to allocate a multi-shot production before requesting a paid quote.
- **`generate`** handles a concrete image or video request from
  references through an exact quote, explicit approval, generation, result
  presentation, and recovery. It also handles account credit and top-up
  handoffs without exposing payment details to the conversation.

The skills are split by user outcome, not by internal tool calls. Reference
selection stays inside the generation workflow because it is an input to a
result, not a separate customer job.

Claude Code exposes these workflows as `/maxvideoai:plan` and
`/maxvideoai:generate`. Claude can also route to them from a natural-language
request. Codex discovers the same two skills from the installed plugin.

## Private reference imports

The generation skill chooses the shortest private path the current host can
actually complete:

- ChatGPT can pass user-authorized attachments or compatible generated file
  results directly to MaxVideoAI. The returned private asset IDs are ready for
  the quote without re-listing the library.
- Compatible ChatGPT or Claude surfaces can render the short-lived in-chat
  importer and accept up to eight files. The browser handoff remains available
  when the host cannot render the app.
- Codex and Claude Code can create one short-lived handoff per local file and
  run the packaged local helper. The helper reads each file locally and sends
  only its bytes and base filename to MaxVideoAI.

These paths work without a public URL or Computer Use. Private source files
remain in the connected MaxVideoAI library, and temporary upload links are
single-use and expire automatically.

## Install in Codex

Use the reviewed release tag so the marketplace definition, skills, and MCP
connection stay on the same version:

```sh
codex plugin marketplace add camgraphe/MaxVideoAi --ref maxvideoai-plugin-v0.3.1
codex plugin add maxvideoai@maxvideoai
```

Start a new Codex conversation after installation. Ask with `$maxvideoai:plan`
to compare models or `$maxvideoai:generate` for a concrete request. The first
live MaxVideoAI action opens OAuth so you can sign in or create the account you
want to connect.

## Try asking

- “Compare the best current models for a cinematic product reveal.”
- “Build two comparable budgets for a 30-second launch film.”
- “Plan a quality-first version and a lower-cost alternative.”
- “Use my existing product image as the first frame of a video.”
- “Give me the exact quote, but do not generate until I approve it.”
- “Show me the status of my latest generation.”
- “Recover the job if the previous response was interrupted.”
- “Present the completed result in this conversation.”

## Account and credits

MaxVideoAI is free to connect and has no separate plugin subscription. Sign in or create a MaxVideoAI account during setup. Model advice and project budgets do not spend credits; approved generations use your existing MaxVideoAI credits on a pay-as-you-go basis.

Private references and completed generations remain in the same MaxVideoAI
Library as the website. If more credits are needed, the assistant returns a
secure MaxVideoAI top-up destination. Payment always happens on MaxVideoAI.

## Current product data

The package contains no copied model catalogue or static pricing. Live tools
remain authoritative as models, capabilities, availability, and prices change.

Learn more in the [MaxVideoAI for ChatGPT and Claude](https://maxvideoai.com/mcp)
overview and the [connection guide](https://maxvideoai.com/docs/mcp).
