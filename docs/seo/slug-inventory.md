# Slug Inventory & Intent Map

This table covers current public routes (and near-term additions), the recommended canonical slug, two alternative options, and the primary search intent each URL should serve.

| Route actuelle | Slug proposé (primaire) | Alternative 1 | Alternative 2 | Intention de recherche |
| --- | --- | --- | --- | --- |
| / | / | /home | /ai-video-platform | Brand + product overview for AI video platform. |
| /models | /models | /ai-video-models | /video-model-catalog | Browse catalog of available AI video generation models. |
| /models/pika-text-to-video | /models/pika-text-to-video | /models/pika-2-2 | /models/pika-text-video | Deep dive on Pika 2.2 text-to-video pipeline. |
| /models/pika-image-to-video | /models/pika-image-to-video | /models/pika-image-video | /models/pika-2-2-image | Walkthrough for Pika 2.2 image-to-video upgrades. |
| /models/openai-sora-2 | /models/sora-2 | /models/openai-sora-2 | /models/sora-text-to-video | Learn about OpenAI Sora 2 capabilities and pricing. |
| /models/sora-2-pro | /models/sora-2-pro | /models/openai-sora-2-pro | /models/sora-pro | Sora 2 Pro pricing, features, and access requirements. |
| /models/google-veo-3-1 | /models/veo-3-1 | /models/google-veo-3-1 | /models/veo-3-1-overview | Google Veo 3.1 feature and pricing breakdown. |
| /models/google-veo-3-fast | /models/veo-3-fast | /models/google-veo-3-fast | /models/veo-fast | Fast Veo 3 render option for quick generation. |
| /models/google-veo-3-1-fast | /models/veo-3-1-fast | /models/google-veo-3-1-fast | /models/veo-3-fastest | Coverage for Veo 3.1 Fast tier. |
| /models/minimax-hailuo-02-text | /models/minimax-hailuo-02-text | /models/hailuo-02-text | /models/minimax-hailuo-text | MiniMax Hailuo 02 Standard text-to-video specs. |
| /models/minimax-hailuo-02-image | /models/minimax-hailuo-02-image | /models/hailuo-02-image | /models/minimax-hailuo-image | MiniMax Hailuo 02 Standard image-to-video specs. |
| /examples | /examples | /ai-video-examples | /video-examples | Gallery of AI video outputs and use cases. |
| /workflows | /workflows | /video-workflows | /ai-video-workflows | Workflow templates for AI video generation. |
| (planned) /workflows/prompt-director | /workflows/prompt-director | /workflows/prompt-engine | /workflows/prompt-production | Guide to using Prompt Director workflow. |
| (planned) /workflows/price-before-you-generate | /workflows/price-before-you-generate | /workflows/pricing-preview | /workflows/pre-price | Workflow for estimating video pricing before runs. |
| /pricing | /pricing | /ai-video-pricing | /pricing-plans | Pricing overview and plan comparison. |
| /calculator | /pricing-calculator | /ai-video-pricing-calculator | /video-generation-pricing | Interactive calculator for AI video run costs. |
| /docs | /docs | /documentation | /help-center | Documentation index for MaxVideoAI. |
| /docs/get-started | /docs/get-started | /docs/start | /docs/onboarding | Onboarding instructions for new users (redirect legacy `/docs/getting-started`). |
| /docs/brand-safety | /docs/brand-safety | /docs/brand-policy | /docs/creative-safety | Brand safety guidelines for generated outputs. |
| (planned) /docs/wallet-and-credits | /docs/wallet-credits | /docs/credits-wallet | /docs/billing-wallet | How wallet and credits work for billing. |
| (planned) /docs/engines | /docs/engines | /docs/model-engines | /docs/video-engines | Overview of supported engines and capabilities. |
| (planned) /docs/pricing-policy | /docs/pricing-policy | /docs/pricing-rules | /docs/usage-pricing | Policies around pricing and usage limits. |
| (planned) /docs/faqs | /docs/faqs | /docs/faq | /docs/common-questions | Frequently asked questions. |
| /blog | /blog | /ai-video-blog | /video-generation-blog | Insights and updates about AI video. |
| /blog/express-case-study | /blog/express-case-study | /blog/express-ai-video-case-study | /blog/express-retail-video | Case study on Express using AI video. |
| /blog/veo-3-updates | /blog/veo-3-updates | /blog/veo-3-release | /blog/google-veo-updates | Announcement of Veo v3 launch and features (redirect legacy `/blog/veo-v2-arrives`). |
| /blog/sora-2-sequenced-prompts | /blog/sora-2-sequenced-prompts | /blog/sora-2-pro-sequenced | /blog/sora-audio-prompts | Sequenced prompt guide for Sora 2 and Sora 2 Pro with branding/audio tips. |
| /blog/access-sora-2-without-invite | /blog/access-sora-2-without-invite | /blog/sora-2-access-guide | /blog/sora-2-invite | How to access Sora 2 via MaxVideoAI and Fal.ai integrations. |
| (planned) /blog/topics/<topic> | /blog/topics/<topic> | /blog/category/<topic> | /blog/tags/<topic> | Topic taxonomy landing pages for blog content. |
| /about | /about | /company | /about-maxvideo | Company background and team. |
| /contact | /contact | /contact-us | /get-in-touch | Contact options for sales and support. |
| /legal | /legal | /legal-center | /legal-hub | Legal hub linking to policies. |
| /privacy | /legal/privacy | /legal/privacy-policy | /legal/privacy-notice | Privacy policy details. |
| /terms | /legal/terms | /legal/terms-of-service | /legal/terms-conditions | Terms of service. |
| /changelog | /changelog | /product-changelog | /updates | Product update log. |
| /status | /status | /service-status | /system-status | Service status overview. |
| (planned) /partners | /partners | /alliances | /partner-program | Information for potential partners. |
| (planned) /affiliates | /affiliates | /affiliate-program | /affiliates-program | Affiliate program details. |

## Documentation Roadmap

- `/docs/get-started` (rename from `getting-started`) — high-level onboarding, connect wallet, first render.
- `/docs/brand-safety` — maintain existing content, ensure outbound links reference policy.
- `/docs/wallet-credits` — explain funding, credit expiry, multi-team billing.
- `/docs/engines` — matrix of engines, capabilities, guardrails.
- `/docs/pricing-policy` — rate changes, surcharge rules, overages, currency handling.
- `/docs/faqs` — curated top 20 customer questions, link to contact.

Each new doc should include:
1. `<link rel="canonical">` pointing to the slug above.
2. Updated entry in `slug-map.yaml` and main docs navigation.
3. Addition to the sitemap via the postbuild automation.

## Reserved Workflow Slugs

- `/workflows/prompt-director` — focus on prompt orchestration and template sharing.
- `/workflows/price-before-you-generate` — highlight credit estimation and forecasting.
- Additional workflows must follow the same naming pattern; reserve future slugs in `slug-map.yaml` before shipping.
