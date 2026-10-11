# Public watch performance

Approved continuation of the CWV audit: remove the unused watch-data quote and send only public navigation messages on direct `/video/[id]` pages. Evidence: `/Users/adrienmillot/.codex/artifacts/cwv-opportunities-2026-10-11/` (`BILAN.md`, `watch-proof/evidence.md`, `watch-layout-audit.md`).

The current watch owner computes a price no consumer reads; displayed offers are owned separately by the real reader quote context. The public watch page also inherits the entire Core dictionary (275,170 compact JSON bytes in the live EN sample), while its consumers require nav/footer (9,575 bytes). These are payload facts, not measured network or LCP gains.

Preserve all public URLs, selection/visibility, redirects, canonical/metadata/JSON-LD, displayed current quotes, exact original media, poster priority/geometry and reader interactions. Keep cookie locale precedence and English fallback, Core full messages, existing auth/session/SWR/theme/font/style/analytics/consent behavior. The watch tree may move to a sibling group under the same HTML root; never narrow Core globally or add a nested provider that leaves the full payload serialized.

Use a shared server runtime to avoid duplicating Core effects and metadata. Performance acceptance requires comparable production builds, actual serialized and compressed page sizes, repeated browser timings, and navigation/locale parity; disclose test fixtures and unavailable production-auth coverage. Reproducible regression blocks release. Deliver through reviewed PR, required Quality CI, current main and deployment provenance checks, normal Git deployment, then verify both public domains. Canonical gallery links and gallery policy reuse remain subsequent independent lots.
