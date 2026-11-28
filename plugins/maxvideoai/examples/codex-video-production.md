<a id="run-a-codex-video-production-workflow-with-recovery-in-mind" name="run-a-codex-video-production-workflow-with-recovery-in-mind"></a>

# Paper Run — plan a skate sequence from one still

**Short answer:** Plan a three-shot sequence, compare the cost of the unfolding shot, then prepare the exact quote and wait for explicit approval.

*Paper Run* is a creative exercise built around an original editorial illustration made with ImageGen. The image gives you a character, a prop and a night setting. The sequence below is a proposed shoot.

## Give the motion a cause

Aim for a six-second widescreen edit. The opening frame shows a crouching rider rolling right beneath a concrete bridge. The folded paper trails the board. Keep both feet planted and the same pool of light on the ground. If a model needs longer takes, budget the supported durations and trim them during the edit.

1. **Approach, 0–2 seconds.** Track beside the front wheel at its speed. Hold the deck low in the frame. Let the first orange fold begin to open behind the rider.
2. **Unfold, 2–4 seconds.** Follow the ripple backward along the ribbon. Three accordion folds open in order. Cut to their shadows when the first one crosses a seam in the concrete.
3. **Exit, 4–6 seconds.** Cut wide on the third shadow. Keep the rider moving right. Let the paper settle after the board leaves the light.

<a id="what-maxvideoai-should-do" name="what-maxvideoai-should-do"></a>

## Compare the shot that could break the edit

```text
Use the reference to plan the unfolding shot first. Compare two current
image-to-video models that accept this kind of image. Hold framing,
duration, resolution and audio settings constant wherever both support
them. If a setting differs, explain what changes in the comparison.

Describe the first and last frame of the shot. What will keep the board,
the rider's screen direction and the order of folds continuous across the cut?
Give me an estimated price for one take on each route and the supported
inputs. Wait for me to select a route and request the exact quote.
```

The catalog and quote establish which settings you can use. The shot list describes the intended result. [MaxVideoAI model catalog](https://maxvideoai.com/models) · [MaxVideoAI pricing](https://maxvideoai.com/pricing)

## What did a five-second take cost to plan?

The five-second test used text-to-video, 720p, 16:9, no audio and one output. The dated comparison includes its prompt and the three MaxVideoAI estimates. Use the live comparison for your own inputs and settings. [Read the recorded comparison](https://github.com/camgraphe/MaxVideoAi/blob/main/docs/marketing/github-examples/paper-run-price-check.md)

<a id="what-is-the-safe-sequence" name="what-is-the-safe-sequence"></a>

## Make the chosen take

In ChatGPT, open the published plugin and connect your MaxVideoAI account. In Codex, run `$maxvideoai:plan` for the comparison and `$maxvideoai:generate` for the chosen take. Use your own authorized image or a private reference from your Library. [ChatGPT setup](../docs/chatgpt.md) · [Codex setup](../docs/codex.md)

<a id="what-to-do-if-the-task-is-interrupted" name="what-to-do-if-the-task-is-interrupted"></a>

Review the exact quote and authorize one attempt when ready. If the task stops, ask for the status of the accepted job. Review the result in your MaxVideoAI Library before deciding whether a change calls for a new quote. [Explore MaxVideoAI assistant workflows](https://maxvideoai.com/mcp?utm_source=github&utm_medium=example&utm_campaign=assistant_video_workflows&utm_content=codex_video_production) · [Recover the accepted job](recover-a-generation.md)
