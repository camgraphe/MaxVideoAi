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
