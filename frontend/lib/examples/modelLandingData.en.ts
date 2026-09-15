import type { CanonicalExampleModelSlug, LocalizedModelDescriptor } from '@/lib/examples/modelLandingTypes';

export const EN_MODEL_DATA: Partial<Record<CanonicalExampleModelSlug, LocalizedModelDescriptor>> = {
  sora: {
    subtitle: 'Cinematic examples, reusable prompts, and shot-level settings for Sora workflows.',
    intro:
      'Use this page to review real Sora examples before you run new renders. You can inspect prompt style, duration, and framing patterns that usually perform well on cinematic scenes, product storytelling, and social cuts. The goal is to help you recreate outputs consistently without mixing unrelated model behavior.',
    promptPatterns:
      'Start with scene intent, camera movement, and a clear subject anchor. Sora examples perform best when prompts separate composition, motion, and lighting constraints in short blocks.',
    strengthsLimits:
      'Sora generally excels in cinematic coherence and polished motion. Limits vary by mode and queue conditions, so keep test runs short before scaling to longer variants.',
    pricingNotes:
      'Pricing depends on duration, resolution, and add-ons. Open an example to inspect its recorded render cost before comparing Sora runs with other engines or starting batch generation.',
    faq: [
      {
        question: 'What prompts work best for Sora examples?',
        answer: 'Structured prompts with clear subject, camera, and motion constraints are the most reliable baseline.',
      },
      {
        question: 'Are these Sora examples reusable in the workspace?',
        answer: 'Yes. You can clone examples and adapt duration, resolution, and style details to your own brief.',
      },
      {
        question: 'How should I budget Sora test runs?',
        answer: 'Start with short test clips, validate motion and composition, then upscale winning variants.',
      },
    ],
  },
  veo: {
    metaTitle: 'Veo 3.1 Examples, Prompts, Settings & Image-to-Video | MaxVideoAI',
    metaDescription:
      'Browse Veo 3.1 examples, prompts, settings, and image-to-video patterns, then open a video detail page to see its recorded render cost on MaxVideoAI.',
    heroTitle: 'Veo 3.1 examples, prompts, settings and image-to-video patterns',
    subtitle: "Veo 3.1 and Gemini Omni Flash 1.1 examples, with prompts, inputs and settings to inspect.",
    intro: "Compare Google video examples from Veo 3.1, Fast and Lite alongside Gemini Omni Flash 1.1. Open a result to inspect its prompt and settings, then adapt the example in your workspace.",
    summary: "Veo and Gemini Omni are distinct Google models grouped in this gallery. Keep the model shown on each example as your reference. Use the linked model pages and comparisons to choose a workflow, then check the current quote before generating.",
    promptPatterns: "Describe the subject, action and camera move first. With an opening image, specify what should move and what should remain. Keep the same brief when comparing models, and change one instruction at a time.",
    strengthsLimits: "Compare motion, framing and subject continuity across the whole clip. Veo and Omni do not share every input or editing option: check the selected model and mode before supplying images, references or a source video. One successful example does not guarantee the same result from a new prompt.",
    pricingNotes: "The example detail page shows the recorded render cost. Your next render uses the current quote for its model, inputs, duration and resolution. Reuse the available settings, add your own sources where needed, and review the quote before submitting.",
    faq: [
      {
        question: "Why are Gemini Omni examples shown in this Veo gallery?",
        answer: "This gallery groups Google video examples, including Veo and Gemini Omni. They remain distinct models: inspect the name on the example and use the Omni versus Veo comparison to choose the right workflow.",
      },
      {
        question: "How do I recreate a Veo or Omni example?",
        answer: "Open the example detail page to review its prompt, settings and recorded cost, then use the recreation action. Check the selected model, supply any required source media and review the new quote in the workspace before generating.",
      },
      {
        question: "How should I compare Veo 3.1, Fast, Lite and Omni?",
        answer: "Use the same subject and creative goal, then compare the whole result and the current quote. Keep the input mode explicit; reference and editing controls vary by model, so a preset should not be assumed to transfer unchanged.",
      },
    ],
  },
  luma: {
    metaTitle: 'Luma Ray 3.2 Modify & Reframe Examples | MaxVideoAI',
    metaDescription: "See Luma Ray 3.2 Modify and Reframe video examples. Inspect prompts and settings for editing a source clip, then check the price before creating your own.",
    subtitle: "Luma Ray 3.2 video edits: change a scene with Modify or adapt its framing with Reframe.",
    intro: "Explore Luma Ray 3.2 Modify and Reframe examples. Open a video to inspect the prompt and settings used to edit it. Ray 2 and Ray 2 Flash examples retain their original model labels.",
    promptPatterns: "For Modify, describe what to preserve from the source video, then the change you want. For Reframe, identify the subject that must remain visible and what should fill the new frame. Use guide images or keyframes only in modes that support them.",
    strengthsLimits: "Judge Ray 3.2 on how well it preserves the source, follows the requested edit and keeps the subject consistent. It does not generate audio in MaxVideoAI. The supported inputs and settings differ from Ray 2 and Ray 2 Flash; check the model shown on each example.",
    pricingNotes: "The detail page shows the recorded cost of the example. Your new edit has its own quote based on the selected mode and settings. Check that price before generating and test a short clip before committing to a longer edit.",
    faq: [
      {
        question: "How can I reuse a Luma video edit?",
        answer: "Open the example for its prompt and settings, then adapt the instructions to your own source video. Private source files are not included, and a new generation can produce a different result.",
      },
      {
        question: "Does Ray 3.2 generate audio?",
        answer: "No. Ray 3.2 examples are silent video outputs. Add voice, music or sound effects separately.",
      },
      {
        question: "Should I use Modify or Reframe?",
        answer: "Use Modify to change the visual content of a source video. Use Reframe to adapt its framing. Check the model page for the inputs and settings supported by each mode.",
      },
    ],
  },
  wan: {
    subtitle: "Wan video examples with prompts, settings and the model used for each result.",
    intro: "Watch Wan examples to compare movement, framing and scene continuity. Open a video for its prompt, settings and recorded cost, then adapt it to your project. Check its model version before reusing the settings.",
    promptPatterns: "Describe one subject, one main action and a camera movement. If the shot has several stages, put them in order and keep the sequence short enough to follow. Change one instruction at a time when testing.",
    strengthsLimits: "Watch the whole clip for changes in the subject, unexpected cuts and motion that does not follow the prompt. Inputs, duration and output options vary across Wan models, so check the selected version and mode.",
    pricingNotes: "The example shows a recorded cost on its detail page. Your model, duration and other settings determine a new quote in the workspace. Review that quote before generating; start with a short test to assess the result.",
    faq: [
      {
        question: "Can I use a Wan example as a starting point?",
        answer: "Yes. Open its prompt and settings, then adapt them in the workspace. Add your own source media when required. Reusing a prompt does not guarantee the same result.",
      },
      {
        question: "Can I adapt a Wan example to a vertical video?",
        answer: "Check that the chosen model and mode support your target format. Adjust the framing so the subject and action fit the vertical composition, then review a test clip.",
      },
      {
        question: "Does changing the duration change the Wan price?",
        answer: "Duration is one of the settings that can change the quote. Select the model and settings you need, then check the price shown before generating.",
      },
    ],
  },
  kling: {
    metaTitle: 'Kling AI Video Examples: Prompts, Motion & Product Shots',
    metaDescription: "Watch Kling 3 and Kling 3.0 Omni video examples. Explore prompts, image-to-video and reference workflows, then inspect settings and recorded costs.",
    heroTitle: 'Kling AI Video Examples, Prompts & Settings',
    subtitle: "Kling 3 and Kling 3.0 Omni examples: see how opening images and visual references shape a shot.",
    intro: "Watch Kling video examples, then open a result for its prompt and settings. Compare Kling 3 opening-image animation with Kling 3.0 Omni reference and video-editing workflows. Each example identifies the model used.",
    summary:
      'Kling 3.0 Omni Pro and Standard are the current routes for reference images, storyboard inputs, and source-video V2V. Kling 3 Pro and Standard remain the start-frame image-to-video routes, while Kling 3.0 Omni 4K is the native 4K reference-guided delivery route.',
    promptPatterns: "Decide whether an uploaded image should guide the video as a reference or appear as its first frame. Use @Image1 and @Video1 to identify sources in supported Omni modes. For Kling 3 image-to-video, describe the motion that should develop from the opening image.",
    strengthsLimits: "Kling 3.0 Omni uses references to guide identity, style, storyboard structure or video edits. A reference is not necessarily the opening frame. Kling 3 image-to-video starts from the uploaded image. Check the chosen model and mode before reusing sources.",
    pricingNotes: "Compare the same duration, aspect ratio, audio and resolution across the supported modes. The detail page records the example cost; the workspace shows the current quote for your chosen model and settings. Review it before generating.",
    faq: [
      {
        question: 'How long can Kling AI videos be?',
        answer:
          'Kling 3.0 Omni Standard and Pro support 1080p reference-guided renders up to 15 seconds, including source-video V2V on Standard and Pro. The O3 4K route is for native 4K reference-guided delivery, while Kling 3 remains the start-frame image-to-video route.',
      },
      {
        question: 'How long does Kling AI take to make a video?',
        answer: "Generation time depends on the model, duration, inputs, audio, resolution and current demand. There is no fixed completion time for every clip. A short test helps you assess both the result and the wait for your chosen settings.",
      },
      {
        question: 'Which Kling AI model should I use for prompts and examples?',
        answer:
          'Use Kling 3.0 Omni Standard or Pro when references, storyboard images, or @Video1 should guide the render without becoming the opening frame. Use Kling 3 Standard or Pro when the uploaded image should be the visible start frame.',
      },
      {
        question: 'How should I use Kling AI for image-to-video prompt testing?',
        answer:
          'For O3, describe each reference role with @Image1, @Image2, or @Video1. For Kling 3, start from one clear source image, one motion instruction, and one camera goal because the image is expected to open the clip.',
      },
      {
        question: 'How should I adapt Kling AI prompts for Kling 3 Pro vs Kling 3 Standard?',
        answer: "Keep the same subject, action, camera direction and supported settings when testing Kling 3 Pro against Standard. Compare the complete videos and current quotes. Both use the opening image for image-to-video; reference-guided Omni is a separate choice.",
      },
    ],
  },
  seedance: {
    metaTitle: 'Seedance 2.5 Video Examples, Prompts & Settings | MaxVideoAI',
    metaDescription: "Watch Seedance 2.5 video examples with prompts and settings. Compare results from other Seedance versions and use an example as a starting point.",
    heroTitle: 'Seedance 2.5 AI Video Examples, Prompts & Settings',
    subtitle: "Seedance 2.5 and earlier versions: watch the results, inspect the prompts and find a starting point.",
    intro: "Explore Seedance 2.5 examples alongside Seedance 2.0, Fast and Mini. Open a video to inspect its prompt, settings and recorded cost. Each result keeps its original model label so you can compare the versions accurately.",
    summary: "Seedance 2.5 supports 4–30 second videos up to 1080p, generated audio, references, editing and extension. Seedance 2.0 remains available for 4K, while Fast and Mini offer other options for drafts and batches. Earlier 1.5 Pro examples keep their original labels.",
    promptPatterns:
      'For Seedance 2.5, define one core action, camera direction and reference role before adding scene detail. Keep the same prompt structure when comparing 2.5 with Seedance 2.0, Fast or Mini.',
    strengthsLimits:
      'Use Seedance 2.5 when longer duration, generated audio, mixed references, editing or extension matter. Its public MaxVideoAI route supports landscape, square and vertical output at 480p, 720p or 1080p; keep Seedance 2.0 when 4K delivery is required.',
    pricingNotes: "Duration, audio and source media can influence the price. The example detail shows its recorded cost; the generator shows the current quote for your selected settings before you launch.",
    faq: [
      {
        question: 'Are all Seedance examples on this page generated with Seedance 2.5?',
        answer:
          'No. The gallery keeps factual labels for Seedance 2.5, Seedance 2.0, Fast, Mini and supported 1.5 Pro renders so you can compare the actual route used.',
      },
      {
        question: 'Which Seedance model should I start with for examples and prompt testing?',
        answer:
          'Start with Seedance 2.5 for the current flagship workflow up to 1080p. Use Seedance 2.0 for 4K intent, Fast for quicker drafts, and Mini for repeatable batch variants.',
      },
      {
        question: 'What settings affect Seedance video pricing most?',
        answer:
          'Duration, generated audio and the use of a source video have the greatest impact on the price. Keep those settings aligned when comparing routes.',
      },
    ],
  },
  ltx: {
    metaTitle: "LTX Video Examples, Prompts & Settings | MaxVideoAI",
    metaDescription:
      "Explore LTX 2.5 Pro and Fast video examples, prompts and settings, with clearly labelled LTX 2.3 and LTX 2 examples for older workflows.",
    heroTitle: "LTX video examples, prompts and settings",
    subtitle: "LTX 2.5 Pro and Fast examples, with earlier LTX versions clearly identified.",
    intro: "Watch LTX 2.5 Pro and Fast examples, then open a video for its prompt, settings and recorded cost. Earlier LTX 2.3 and LTX 2 results keep their original labels so you can compare versions.",
    summary:
      "LTX 2.5 Pro and Fast lead this page. Older LTX 2.3 and LTX 2 examples keep their original model labels so you can compare generations without confusing their capabilities.",
    promptPatterns: "Describe the subject, action, camera movement and visual style. For image-to-video, explain how the scene should move from the opening image. Keep the same starting point and change one instruction at a time.",
    strengthsLimits: "Compare the whole clip across Pro and Fast: does the motion follow the prompt, and does the subject remain consistent? Use the same source image for image-to-video tests. A successful example is a starting point, not a guarantee of identical results.",
    pricingNotes: "Keep the model, mode, duration, resolution and available audio settings explicit when comparing costs. The detail page records the cost of that example; check the current quote in the workspace before generating your version.",
    faq: [
      {
        question: 'What are the best LTX 2.5 prompt examples to start from?',
        answer:
          'The best starting point is a simple structure: subject, action, camera direction, and style goal. The strongest examples keep that structure stable while changing only one variable at a time.',
      },
      {
        question: 'How should I structure an LTX 2.5 prompt?',
        answer:
          'Start with one clear subject, one main action, one camera instruction, and one visual style cue. LTX 2.5 prompts usually work better when the motion goal is explicit and the scene description stays tight.',
      },
      {
        question: 'What settings matter most for LTX 2.5 outputs?',
        answer:
          'The main settings to watch are duration, aspect ratio, source image choice for image-to-video, and how much motion complexity you ask for in a single prompt. Keeping those stable makes prompt testing much easier.',
      },
      {
        question: 'How should I prompt LTX 2.5 for image-to-video?',
        answer:
          'Start from a strong source image, then add one motion instruction, one camera movement, and one output goal. LTX 2.5 image-to-video works best when the prompt extends the source image instead of replacing it with a completely different scene.',
      },
      {
        question: 'Which LTX model should I use: LTX 2.5 Pro or LTX 2.5 Fast?',
        answer:
          'Compare LTX 2.5 Pro and Fast with the same prompt and settings. Use the examples to judge the output you need and the current pricing page to compare costs. Check each model page for supported modes and limits; older LTX examples describe the version shown on their label.',
      },
    ],
  },
  pika: {
    subtitle: 'Pika examples for short-form creative loops, stylized edits, and social-ready motion.',
    intro:
      'This Pika examples page is built for short-form, stylized output patterns. It helps creators and growth teams quickly clone proven motions, update prompt details, and publish social-ready variants without rebuilding settings from scratch. The content is intentionally focused on Pika behavior only.',
    promptPatterns:
      'Use style-first prompts with one clear action and concise camera direction. Pika examples usually improve when scene scope stays narrow.',
    strengthsLimits:
      'Pika is often effective for fast loops and stylized social visuals. Keep prompt structure simple to avoid unstable transitions.',
    pricingNotes:
      'Pricing is easiest to control with short durations and fixed output settings. Validate one successful template, then duplicate.',
    faq: [
      {
        question: 'What is the best way to reuse Pika examples?',
        answer: 'Clone a relevant example, keep the motion template, and swap only subject/style elements first.',
      },
      {
        question: 'Are Pika examples suitable for social ad variants?',
        answer: 'Yes. They are optimized for short, stylized, and iteration-friendly outputs.',
      },
      {
        question: 'How do I keep Pika costs predictable?',
        answer: 'Lock duration and resolution presets before running multiple variants.',
      },
    ],
  },
  hailuo: {
    subtitle: "MiniMax H3 Max, H3 and earlier Hailuo video examples, with prompts and settings to explore.",
    intro: "Watch MiniMax H3 Max and H3 alongside earlier Hailuo examples. Open a video to inspect its prompt, settings and recorded cost, then use it as a starting point for your own scene.",
    summary: "Each MiniMax or Hailuo example keeps the name of the model that generated it. Compare motion, scene continuity and any audio across the full clip. Use the H3 and H3 Max model pages to check the inputs and settings available for your project.",
    promptPatterns: "Start with the subject, one clear action and camera direction. Add scene or sound instructions when relevant to the selected model. For reference-based work, give each permitted source a clear role and check that the model supports that input.",
    strengthsLimits: "Judge the full result: subject identity, motion, framing and any generated audio. H3 Max, H3 and older Hailuo models have different modes and output choices. An example shows one result; it does not establish perfect consistency or identical controls across the family.",
    pricingNotes: "Compare H3 and H3 Max with the same brief and intended output. The detail page records the example cost; the workspace provides the current quote for your next render. Validate a short shot, then expand the versions that meet your visual criteria.",
    faq: [
      {
        question: "Why are MiniMax H3 and H3 Max in the Hailuo gallery?",
        answer: "This gallery brings together MiniMax video models, including H3, H3 Max and earlier Hailuo versions. The label on each video identifies the model used. Older examples do not represent the capabilities of H3 or H3 Max.",
      },
      {
        question: "How do I choose between MiniMax H3 and H3 Max?",
        answer: "Open the H3 versus H3 Max comparison and their model pages. Compare the available inputs, resolution choices and current quote against your target output, then inspect examples made with the exact model you plan to use.",
      },
      {
        question: "Can I reuse a MiniMax example in my workspace?",
        answer: "Open its detail page, inspect the prompt and recorded settings, then use the recreation action. Add your own required media and review the current quote before generating; a public example does not grant access to private source files.",
      },
    ],
  },
  grok: {
    subtitle: 'Grok Imagine Video 1.5 examples for text-to-video, opening-image animation, and reference-guided clips.',
    intro:
      'Use this family page to study Grok Imagine Video 1.5 through MaxVideoAI’s Fal route. It covers text-to-video, image-to-video from one opening image, and reference-to-video workflows using one to seven reference images; availability on MaxVideoAI does not imply a direct xAI integration. Treat the gallery as evidence for choosing an input strategy, not as a promise that one prompt works for every mode. Text starts are useful when composition can be invented from the brief. An opening image is better when the first composition, subject placement, wardrobe, product, or palette already exists. A reference set is appropriate when several permitted images have separate jobs, such as identity, object design, environment, or lighting. Review prompt, mode, duration, resolution, framing, and accepted output together. A visually attractive result does not by itself prove reference fidelity, readable incidental text, stable hands, or continuity through the final beat. Compare examples with the same acceptance criteria and keep likeness consent, source rights, and brand safety in the production review.',
    promptPatterns:
      'For text-to-video, state the subject, action, camera, and light, then describe the ending that should still be visible when the clip stops. Keep one main action and one camera intention so motion failures are diagnosable. For an opening image, describe only the motion that should develop: what remains fixed, what moves, how the camera reacts, and which visual details must survive. Do not ask the prompt to redesign the source and preserve it at the same time. For reference work, assign a clear role to each reference instead of repeating visual detail. Name the images in order, identify which one controls the person, garment, object, location, or palette, and explain how those roles meet in a single shot. One or two precise references can be clearer than seven conflicting sources. Put negative constraints after the positive shot direction and reserve them for visible failure risks such as unwanted logos, duplicate subjects, extra limbs, accidental captions, or a camera cut. When comparing two prompts, change one variable and keep source images, duration, resolution, and framing stable.',
    strengthsLimits:
      'Grok supports flexible text, opening-image, and multi-reference starting points. Text and image workflows can use the higher output tier shown by the model route, while reference mode is limited to its displayed 480p or 720p choices. The opening image owns framing in image-to-video, so a separate aspect-ratio promise should not be inferred. Reference mode accepts images, not a source video, audio track, or generic document. More references increase direction complexity and should not be treated as automatic consistency. Evaluate opening readability, subject identity, motion, anatomy and geometry, unwanted text or watermarks, and the final beat separately. The family page does not claim native audio, direct xAI execution, guaranteed lip sync, perfect typography, or controls absent from the selected mode. Queue behavior, availability, and exact pricing can change without changing the creative contract, so use the live model details and pre-render quote. For a high-stakes likeness or product, run a short diagnostic first, inspect every frame, and keep a human approval step before publication.',
    pricingNotes:
      'Use the quote shown before generation; this copy owns no provider rate or finished total. Start with a short 480p or 720p reference diagnostic, or a 720p text or image test, before moving an approved direction to the higher settings offered by that mode. The reference quote must receive the actual number of images rather than a generic text-video assumption. Compare cost only when mode, duration, resolution, and reference count match. Keep rejected attempts in the production record so speed and stability are not judged only from successful examples.',
    faq: [
      { question: 'Can Grok start from an image?', answer: 'Yes. Image-to-video uses one opening image and asks the prompt to direct motion from that composition. Reference-to-video accepts a set of images with named roles. Choose the opening-image route for one authoritative frame and the reference route when identity, object, setting, or palette must come from separate permitted sources.' },
      { question: 'How many references can I use?', answer: 'The reference workflow accepts one to seven images. Capacity is not a target: use only the sources needed for the brief, give each one a distinct purpose, and remove redundant or contradictory material. Keep the image order stable while testing prompts so fidelity changes can be attributed to the instruction rather than a reordered set.' },
      { question: 'Is this a direct xAI route?', answer: 'No. xAI owns the Grok model family, while MaxVideoAI currently distributes this model through Fal. The examples describe the capability exposed by that route and should not be read as a claim of direct xAI API access, identical queue behavior, or features not visible in the current model details.' },
      { question: 'How should I review a Grok example?', answer: 'Check whether the opening composition or named references remain recognizable, then score motion, camera, anatomy, geometry, unwanted text, watermarking, and the final beat. Review the whole clip rather than one thumbnail, and treat any requested but missing behavior as evidence rather than explaining it away after generation.' },
    ],
  },
  flux: {
    subtitle: 'FLUX 3 and FLUX 3 Draft examples for text-to-video, image animation, start/end frames, and Extend.',
    intro:
      'This page compares the standard FLUX 3 route with FLUX 3 Draft through MaxVideoAI’s Fal distribution. Use it for text-to-video, image-to-video from an opening frame, first-and-last-frame transitions, and the separate Extend workflow for continuing an existing clip. The family view helps decide both model tier and input workflow. Draft is for controlled 720p exploration when the team still needs to validate action, camera, source compatibility, or transition logic. Standard FLUX 3 is the production-oriented sibling and exposes the higher resolution option shown on its model page. Neither label removes the need to review the output. A useful example records the source role, prompt, mode, duration, resolution, and visual acceptance question. Compare like with like: a frame bridge should be judged on the path between anchors, an extension on continuity with the source clip, and a text start on the shot invented from the brief. Black Forest Labs owns FLUX; the route described here is Fal-distributed rather than a claim of direct provider execution.',
    promptPatterns:
      'Describe one shot, a specific camera move, a measurable subject action, the physical environment, and an ending that can be reviewed. Avoid combining several unrelated beats in one diagnostic render. For image-to-video, say what must remain from the opening composition before adding motion. When using first and last frames, supply both required anchors and write the transition between them: how pose, object position, material, camera, and light evolve without an impossible jump. Compatible perspective and identity make the bridge easier to assess. For Extend, describe what should happen after the source clip rather than restating it. Continue the final camera vector, subject trajectory, lighting, rhythm, and scene state before introducing anything new. A hidden cut, reset pose, or replacement subject is a continuity failure even if the last frame looks polished. Use Draft to compare one variable at a time and keep the winning source files, prompt structure, and acceptance criteria unchanged when testing standard FLUX 3.',
    strengthsLimits:
      'FLUX 3 is the standard-quality route and Draft is intended for quicker iteration at its fixed 720p tier. Both siblings expose distinct text, opening-image, first-and-last-frame, and extension contracts; required inputs do not become optional on Draft. Extend is a separate video continuation mode with an eligible source clip and its own canonical pricing facts. A start/end workflow is not the same as a loose image-reference set, and an opening-image workflow should not imply a separately selectable aspect ratio when the source controls framing. Do not infer native audio, lip sync, reference-video transformation beyond Extend, or controls that are not shown in the selected mode. Review source preservation, camera continuity, subject identity, anatomy, geometry, accidental text, watermarking, and the final beat. Draft output is evidence for a creative decision, not a guarantee that standard will reproduce every pixel. For delivery, rerun the selected direction on the intended sibling and review that result independently.',
    pricingNotes:
      'Draft is useful for validating direction before a standard FLUX 3 pass. Confirm the pre-render quote because duration, resolution, tier, and mode affect cost, and Extend must never inherit a normal-generation rate by omission. This family copy contains no fixed amount. Compare costs with the same source and settings, record failed or rejected attempts, and upgrade only the directions that meet the written visual criterion. A cheaper draft is valuable when it removes uncertainty; repeated uncontrolled drafts are not automatically an efficient workflow.',
    faq: [
      { question: 'When should I use FLUX 3 Draft?', answer: 'Use Draft when a 720p test can answer one concrete question about prompt direction, motion, opening-image preservation, frame compatibility, or extension continuity. Keep the approved prompt and source files for the standard pass. Do not present Draft as final-production equivalence or assume that an attractive thumbnail proves the transition works.' },
      { question: 'Can FLUX 3 continue a video?', answer: 'Yes. Choose the separate Extend mode, supply an eligible source clip, and describe the continuation after its visible final state. Preserve camera direction, subject position, light, and rhythm before introducing a new action. Extension pricing and validation remain mode-specific rather than borrowing the normal generation contract.' },
      { question: 'How do first and last frames differ from image-to-video?', answer: 'Image-to-video animates one opening composition. First-and-last-frame mode requires two anchors and must construct a plausible path between them. Use two compatible images, state what transforms and what stays stable, and judge the complete bridge rather than only its endpoints.' },
      { question: 'Does FLUX 3 include native audio?', answer: 'No audio capability is claimed on this family page. Use only the inputs and controls displayed for the selected FLUX mode, and plan voice, music, or sound design as a separate production step unless the live model details explicitly change.' },
    ],
  },
};
