
# MaxVideoAI — Discovery‑First “Wall of Videos” Architecture
**Audience:** marketing, product, and UX/ergonomics design.  
**Goal:** turn the site into a high‑conversion, high‑retention discovery experience with clear costs and premium perception.

---

## 1) Strategic stance
**Positioning:** “All the AI video engines. One control room. Clear prices.”  
**North‑star metric (NSM):** number of **successful remixes** (clips generated from Wall items or Collections).  
**Guard KPIs:** CTR from Wall → Clip, Clip → Remix, Remix → Payment success, % clips enhanced (Upscale/Reframe/Audio), avg. $/user, LCP < 2.0s on mobile.

**Why this wins:**  
- Proof‑first: the Wall shows breadth + quality immediately.  
- Choice without chaos: hierarchy (Premium / Pro / Budget / Open) + filters.  
- Cost clarity: every tile shows the price; trust ↑, friction ↓.  
- Upsell surface: Enhance is visible everywhere (high margin).

---

## 2) Information Architecture (IA)
**Top‑level routes**  
- `/` — **Wall** (infinite masonry, filters & sort)  
- `/clip/:id` — **Recipe card** (video, params, cost, Remix, Enhance, Similar)  
- `/collections` & `/collections/:slug` — **Curations** (Cinematic, Best Value, Vertical Ads, Logo Morphs…)  
- `/chains` — **Super features** (Morph, 4K Upscale, Reframe, Add Audio)  
- `/generate` — **Toolkit** (Engine→Version, Cost Pin, Enhance toggles, Templates)  
- `/pricing`, `/about`, `/legal` (Licenses/Usage), `/submit` (opt‑in publish to Wall)

**Navigation:** minimal top nav (Logo ▸ Explore ▸ Collections ▸ Chains ▸ Pricing ▸ Sign in).  
**Search/Command palette (`⌘K`)**: “cinematic 9:16 under $1 via Hunyuan” → pre‑filters Wall.

---

## 3) Homepage = The Wall (masonry)
**Above‑the‑fold:**  
- Slim filter bar: **Tier** (Premium/Pro/Budget/Open) · **Engine** · **Aspect** · **Duration** · **Price bucket**.  
- Toggle: **“Show audio‑capable only”**.  
- “Editor’s Picks” row pinned first screen.

**Tile anatomy:**  
- Looping silent clip (webm, 5–8s). Poster + sprite for hover scrubbing.  
- Badges: `Veo 3 · 8s · 1080p · 16:9 · audio on`  
- **Cost chip:** `$3.20` or `$0.40/clip`  
- CTAs (always visible on hover / focus): **Remix** · **Enhance** (Upscale/Reframe/Audio)  
- Menu: “Open recipe” → `/clip/:id`

**Empty/slow states:** skeleton cards; show cost & labels first, then swap in video when ready.

**Ergonomic rules:**  
- Tile min size ≥ 256×256; tap target ≥ 44px; 8‑pt spacing system.  
- Limit max 9 videos playing concurrently (pause the rest).  
- Reduce motion preference: show posters only unless user taps to play.

---

## 4) Clip page = Recipe Card (SEO & conversion)
**Header:** video player (muted, loop) + **download** if allowed.  
**Sidebar:**  
- **Engine & version** with **Usage rights** badge.  
- **Params** (prompt truncated with expand, duration, res, aspect, audio, seed).  
- **Cost at generation** (and current estimate, if changed).  
- **Primary CTA:** **Remix this clip** (prefills `/generate`)  
- **Secondary CTA:** **Enhance** (Upscale/Reframe/Audio)  
**Footer:** Similar clips (same engine/tag), Share buttons (OG/OpenGraph).

**SEO:** `VideoObject` JSON‑LD + human title: “Kling 2.5 cinematic b‑roll — $0.35 (5s, 720p)”.

---

## 5) Collections (Curation layer)
Purpose: reduce choice overload with **intent‑based** sets.  
Examples: *Cinematic Quality*, *Best Value HD*, *Vertical Ads*, *Logo Morphs*, *UGC Hooks*.  
Each collection has: hero copy (when to use), starters (3 tiles), rest of wall filtered.

---

## 6) Chains (Super Features)
Cards with mini demos + plain pricing + one‑click run:  
- **Morph** (Image A→B, smooth animate) — built on Hailuo/WAN 2.2.  
- **Upscale 4K** (Topaz/SeedVR2) — temporal consistency.  
- **Reframe** (Ray‑2) — 16:9↔9:16 subject‑aware.  
- **Add Audio** — music/VO merge (library or upload).

Each chain page: short explainer, cost calculator, run form, results show on Wall.

---

## 7) Generate (Toolkit) — ergonomics
- **Engine → Version** selector (model‑aware inputs).  
- **Cost Pin**: shows live estimate; totals include Enhance toggles.  
- **Templates**: quick‑start from Wall recipes or Collections.  
- **Guidance**: inline hints per engine (durations, AR limits, audio).  
- **Result handoff**: post‑success modal → “Publish to Wall” (opt‑in).

**Form heuristics:** inline validation, smart defaults (e.g. Pika 5s 720p 16:9), keyboard navigation, autosave last settings.

---

## 8) Onboarding (first session)
**Goal selector:** “Make a cinematic ad / a TikTok vertical / morph a logo / animate my photo”.  
Prefill engine/version and params; give **demo credits** (e.g. 1 budget clip + 1 enhance).  
Show a 20‑sec **guided tour**: Wall → Clip → Remix → Enhance.

---

## 9) Pricing & monetization
- **Tiers:** Premium (Veo/Kling incl. 4K upscale), Pro (Hailuo Pro/Pika/Luma), Starter (WAN/Hunyuan), Pay‑as‑you‑go.  
- **Anchoring:** show Premium first (higher price), then Pro/Starter as great value.  
- **Everywhere upsells:** after render, at tile hover, in Clip page, and in checkout.  
- **Watermark policy:** default on Budget/Open; “remove watermark” is a paid Enhance.  
- **Bundles:** “1080p + 4K Upscale”, “Dual export 16:9 & 9:16”.

---

## 10) Design system (for designer‑ergonomist)
**Grid & spacing:** 12‑col responsive, 8‑pt spacing.  
**Breakpoints:** 360 / 600 / 768 / 1024 / 1280 / 1536.  
**Type scale (rem):** 48/40 (H1), 32/28 (H2), 24 (H3), 18 (body‑lg), 16 (body).  
**Contrast:** AA minimum (4.5:1 body, 3:1 UI).  
**Interactive:** hover, focus (visible ring 2px), pressed states; keyboardable everywhere.  
**Tap targets:** ≥44×44px; minimum spacing 8px.  
**Motion:** 120–200ms ease‑out; respect `prefers-reduced-motion`.  
**Cards:** soft shadows (blur 20, y 6), radius 16–24.  
**Color tokens:** `--brand`, `--accent`, `--success`, `--warning`, `--bg`, `--surface`, `--text`, `--muted`, `--ring`.  
**Iconography:** clear badges for **audio‑capable**, **vertical‑ready**, **open‑source**, **best value**.

---

## 11) Accessibility & content
- Captions/alt for every clip (short scene description).  
- Keyboard controls to play/pause clips; safe focus order.  
- Avoid infinite motion; pause after 9 played clips; explicit “Pause all”.  
- Copy tone: concise, cost‑first, action‑oriented.  
- Max line‑length: 65–80 chars for body text.

---

## 12) Performance budget (Core Web Vitals)
- **LCP < 2.0s** on mobile: hero uses posters; videos lazy‑load.  
- **Video weight:** target 0.5–1.5 MB per loop (webm). Serve 360–720p depending on viewport.  
- **Concurrency cap:** max 3–5 autoplay at once; pause others.  
- **CDN:** edge cache webm/mp4, poster, sprite.  
- **Precompute** poster & sprite on webhook; store with clip.  
- **JS budget:** < 200 KB gzipped for Wall; hydrate progressive components.  
- **Safari fallback:** mp4 (H.264) if webm not supported.

---

## 13) Analytics & experimentation
**Core events:**  
- `wall.view`, `wall.filter.change`, `tile.hover.play`, `tile.remix.click`, `tile.enhance.click`  
- `clip.view`, `clip.remix.click`, `clip.enhance.click`  
- `generate.open`, `generate.submit`, `generate.success`, `enhance.success`  
- `checkout.open`, `checkout.success`

**A/B tests:**  
- Wall default sort (Trending vs New vs Value).  
- Hero pattern (static hero vs hero‑masonry mini wall).  
- Tile CTAs (single Remix vs Remix+Enhance).  
- Pricing teaser position (mid vs low on page).

---

## 14) SEO & sharing
- **Dynamic sitemaps** for `/clip/*` & `/collections/*`.  
- **JSON‑LD** `VideoObject` on clip pages; `ItemList` on Wall.  
- Titles with engine, cost, duration (e.g., “Pika 2.2 stylized loop — $0.45 (5s, 1080p)”).  
- **OpenGraph** previews with poster image; Twitter Player Card if feasible.  
- Canonicals for filtered walls (avoid index bloat).

---

## 15) Governance & moderation
- Default private; **opt‑in** publish.  
- Auto‑flags: faces, logos, NSFW; manual queue.  
- Show model usage rights per clip; link to **Licenses & Usage**.  
- DMCA takedown process, report button on clip page.

---

## 16) Content & copy (starter kit)
**Hero H1:** All the AI video engines. One control room. Clear prices.  
**Hero sub:** Pick Veo 3, Kling 2.5, Pika 2.2, Hailuo, and more — see the cost upfront, then render instantly.  
**Tile microcopy:** Audio on/off may affect per‑second pricing.  
**Chains headers:** Morph | Upscale 4K | Reframe | Add Audio.  
**Pricing teaser:** Pricing that tracks your render, not your time.

---

## 17) Rollout plan (30/60/90)
**30 days:** Wall MVP + Clip page + basic filters + Remix flow + pricing teaser + analytics.  
**60 days:** Collections & Chains + Enhance upsells everywhere + SEO (clip pages) + moderation.  
**90 days:** Command palette, agency features (boards, dual exports), A/B tests at scale.

---

## 18) Acceptance criteria (design/ergonomics)
- Users can discover, open a clip, remix, and pay in < 90 seconds.  
- All interactive elements keyboard‑navigable with visible focus.  
- Cost is visible on every tile and before every render.  
- Wall maintains 60fps scroll with ≤ 9 concurrent video plays.  
- LCP p75 < 2.0s mobile; CLS < 0.1; INP < 200ms.
