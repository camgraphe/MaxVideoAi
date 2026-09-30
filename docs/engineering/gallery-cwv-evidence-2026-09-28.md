# Gallery Core Web Vitals evidence, frozen 28 September 2026

This file separates reproducible local findings from invalid runs. It is a local handoff for the gallery task, not CrUX, INP, Search Console, or production evidence.

## Controlled setup

- Baseline: `add7b773b24af04ae7ef33917628dcea3f67c58e`, production build `uwUqnJRCOoHnJF3bVtdTV`.
- Final candidate checked: `2d2721ce3f16e9a40b7f98d20bbe774a5ca193e7`, production build `xUT2d5i4_m0SRVCTq1Do4`.
- Frozen public-content snapshot SHA-256: `c84a0c37a3d91325952f91f3ecc40315edabc80a1fe6c2babf2ed9f586e35dcb` (316 unique cards, 266 hub members, 13 feeds). Both builds used the same local PostgreSQL 17 fixture through read-only application connections. No real account, GA identifier, analytics consent, or production database connection was used.
- Lighthouse 12.6.1 / Chrome 153. Cold groups: three alternating visits per version. Warm groups: an excluded seed followed by two retained visits per version in separate persistent browser profiles. Mobile 412×823 at DPR 1.75; desktop 1350×940 at DPR 1. All valid groups below had no Lighthouse warnings/runtime errors and comparable CPU benchmark indices. Speed Index is a lab visual metric, not a Core Web Vital.

## Valid paired groups

| Candidate / gallery scenario | Baseline median | Candidate median | Reading |
|---|---|---|---|
| `75f425aa9` mobile cold LCP | 1,896.6 ms | 1,903.9 ms | Essentially unchanged (+7.3 ms). |
| `75f425aa9` mobile cold Speed Index | 2,150 ms | 2,279 ms | +129 ms. |
| `75f425aa9` mobile warm LCP | 811.4 ms | 821.9 ms | Essentially unchanged (+10.5 ms). |
| `75f425aa9` mobile warm Speed Index | 801.5 ms | 835.5 ms | +34 ms. |
| `bb6df9f23` mobile cold LCP | 1,902.4 ms | 1,889.2 ms | No proven gain; one CPU pair was lower than the others. |
| `bb6df9f23` mobile cold Speed Index | 2,145 ms | 2,272 ms | +127 ms, similar to `75f`. |
| `80a9810b6` desktop cold LCP | 1,959.6 ms | 1,924.0 ms | −35.6 ms in this local group. |
| `80a9810b6` desktop cold Speed Index | 3,034 ms | 3,835 ms | +801 ms; visually slower poster fill. |
| `80a9810b6` desktop warm LCP | 894.7 ms | 771.7 ms | −123 ms in this local group. |
| `80a9810b6` desktop warm Speed Index | 1,293 ms | 2,085 ms | +792 ms, including when posters/media came from disk cache. |

All valid groups had negligible CLS: mobile candidate 0.000225 versus baseline 0; desktop candidate 0 versus baseline 0.000161. TBT was low in the valid groups but does not measure field INP. The `75f` mobile preview change removed incidental mobile MP4 transfer before user exploration (about 61.7 kB in the initial richer-gallery candidate). The `80a` desktop policy reduced initial preview media from about 207.1 kB to 61.7 kB while allowing more previews after hover/focus. These changes affect real browser behavior, not just Lighthouse.

Network image transfer for the valid cold groups was 156,629 B baseline versus 285,464 B at `75f`, then 278,572 B at `bb6` (6,892 B less than `75f`); the mobile side-card request changed from `w=750` to `w=640` at 412 px/DPR 1.75. On desktop, `80a` transferred 138,282 B baseline versus 370,446 B candidate because its denser layout loaded 24 optimized posters versus eight baseline posters in the comparable group. The desktop Speed Index regression persisted on warm cache, so cold image transfer alone does not explain it.

Raw valid groups: `gallery-mobile-cold-75f/`, `gallery-mobile-warm-75f/`, `gallery-mobile-cold-bb6/`, `gallery-desktop-cold-80a/`, `gallery-desktop-warm-80a/`; individual LHRs, traces, run rows, and metadata are retained there. The summaries `mobile-preview-75f.md` and `desktop-preview-80a.md` explain the intermediate tradeoffs.

## Deterministic final-SHA checks, not final Lighthouse acceptance

On `2d2721c` at 1350 px desktop/DPR 1, the two opening side posters displayed at about 369 CSS px select `w=384` (previously `w=640`), and continuation portraits displayed at 168–170 CSS px select `w=256` (previously `w=640`). At DPR 2 those portraits select `w=384`, and the screenshot `2d-desktop.png` shows the opening visually intact. At 412 px mobile/DPR 1.75, the lead remains `w=750`, opening portrait `w=384`, sides `w=640`, and continuation portrait `w=750`; the mobile source choice is unchanged.

With the same fixture and desktop cold request set, final-candidate image transfer was 301,421 B in each observed run versus 370,446 B for `80a`: **69,025 B fewer image bytes (18.6%)**. Initial preview media remained about 61.7 kB. This is a deterministic request/byte result, not evidence that final-SHA LCP or Speed Index improved. Some non-portrait continuation images remain wide and request larger variants; this change was deliberately limited to the two identified sizing errors.

## Invalid final-SHA Lighthouse attempts

No complete, trustworthy Lighthouse group exists for `2d2721c`. `desktop-sizes-2d-cold/` stopped on Lighthouse's “page loaded too slowly” warning. The retry `desktop-sizes-2d-cold-retry/` produced all six LHRs without warnings but the host CPU benchmark collapsed mid-series: baseline indices `[3114.5, 1648.5, 1589.5]`, candidate `[2693, 2478, 1563.5]`, versus roughly 3,860–3,900 in the valid groups. TBT varied sharply on both versions. Its `summary.json` was generated mechanically but **must not be used for acceptance or claimed CWV gains/regressions**. The interrupted `desktop-sizes-de1-cold/` is likewise incomplete and superseded by the final SHA.

The fixture intentionally covers public gallery/readers and has a known content-selection difference: the baseline hub API reports 251 entries while the candidate reports 266 against the same 266-member playlist. Model routes returned HTTP 500 in both builds because unrelated model tables were omitted from this minimal fixture, so this evidence does not cover model-page loading. A full final-SHA route matrix (hub, family, landscape/portrait readers; mobile/desktop; cold/warm) remains unmeasured. Field p75 LCP/INP/CLS, consented Analytics cost, and GSC outcome require real-user data after deployment; none can be inferred from these local runs.
