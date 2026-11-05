# Studio native creation guidance

Approved direction: a client without assets should receive a concrete creative proposal in MaxVideoAI, with coherent images then animation when useful and supported. Ideation starts immediately; generation remains governed by the existing request, exact quote and client confirmation.

The active owner is `frontend/src/server/studio/conversation-director-instructions.ts`, delivered by `createStudioConversationDirector`. Add a compact creative block there. Keep scope, task budgets, reference ownership/roles, enabled capabilities, preparation and payment authority unchanged. Do not modify the legacy image pilot or Composer authorization.

Useful reference guidance explains the role of costume, period objects, architecture, location, character identity, composition or lighting. References improve direction and consistency; they never guarantee exact identity, location, historical authenticity or unchanged pixels. Missing optional references must not block useful ideation. A missing subject can still require one short question.

An explicit real-footage requirement stays in memory. Offer a concrete AI-generated alternative transparently without treating it as accepted, rewriting memory or preparing synthetic media against that constraint. External stock/sourcing belongs to an explicit sourcing request or a maintained actual-capture requirement, rather than the default answer to missing assets. No assembled-film export promise or invented research, references, tools, models or prices.

The parent separately authorized an adjacent Studio long-reply boundary correction after an offline reproduction. Its owner supplies `STUDIO_CONVERSATION_REPLY_MAX_CHARS`; the task instruction interpolates that shared value while preparation tools keep their separate prompt limits. This does not change the creative or payment authority above.

## Synthetic scenario matrix

These are human-language review cases, not recorded customers or claims of real-model success.

| Case | Synthetic input/context | Expected guidance | Unacceptable outcome |
| --- | --- | --- | --- |
| No assets | “J’ai rien, mais je veux une annonce de voyage mystérieuse.” | A concrete direction and useful images→animation plan | Stock referral or generic permission to begin |
| Saved real footage | Earlier: “Only authentic filmed footage of the old harbor.” Now: “I have no assets.” | Clearly labeled AI alternative; original constraint retained | Silent substitution, memory rewrite or synthetic preparation |
| Actual capture insisted | “No AI reconstructions. I need genuine recordings.” | Respect actual capture and help with verified sourcing/import | Continue pushing generated imagery or invent retrieval/purchase tools |
| Era and realism | “Je veux une scène de gare réaliste en 1930. Je n’ai aucune référence.” | Useful costume, luggage, train and architecture references with explicit assumptions | Guaranteed authenticity or a mandatory reference questionnaire |
| Exact place/identity | “Keep our theatre facade and host exactly unchanged.” | Explain required reference roles and fidelity limits | Promise pixel-identical generative preservation |
| Missing subject | “I’d like to create a video about…” | One short essential subject question | Invent a topic or give a long generic tutorial |
| Attached references | Images of a subject, outfit and location are attached | Distinguish their roles and use only supported combinations | Claim to see absent references or invent source IDs |
| Advice only | “Give me two visual directions. Do not make anything.” | Useful creative advice within the current request | New creation, purchase or extra permission gate |
| Images only | Same useful brief, video/audio disabled | Image direction within enabled capabilities | Promise current video/audio execution |
| Requested creation | “Use the chosen direction and prepare its first image.” | Existing compatible exact quote, awaiting client confirmation | Auto-confirm or demand a new ideation consent |
| Long film | “Plan a longer mystery with narration and music.” | Proportionate sequence/continuity plan using supported assets and timeline facts | Mandatory recipe, arbitrary one-clip duration or assembled-film export promise |

## Verification and limits

Offline director tests establish that this guidance reaches the real request alongside intact client memory, scope and feature/payment gates. Existing capability and quote/confirmation tests protect execution. Injected provider responses do not establish semantic quality; the matrix needs human review of actual responses if a separately authorized real-model evaluation is later run. No paid/provider/media calls are part of this change.
