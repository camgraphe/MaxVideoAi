# Nano Banana 2.1 MCP routing activation

The Nano21 launch uses the existing Google Vertex image provider, its existing credentials and the six approved fixed customer tariff cells. App publication and public price quotes do not establish MCP executability: the MCP provider guard also requires explicit per-engine admission.

After PR549 reached Git production at `9a56cb733f7ff7165566b02f4f058cb85fe24956`, live `list_models` returned Nano21 with no executable modes. All four earlier Vertex image models still returned `t2i` and `i2i`, with generation enabled. The production model allowlist had not been updated for the newly published identity. Do not bypass this guard or substitute Nano2 for Nano21.

## Production policy

Keep the existing two global image MCP gates, Vertex credentials and private input bucket configuration. The production value of `GOOGLE_VERTEX_IMAGE_MCP_ENGINE_ALLOWLIST` admits the complete five-engine Vertex image family:

```text
nano-banana,nano-banana-lite,nano-banana-pro,nano-banana-2,nano-banana-2-1
```

The four previous effective public admissions were independently checked through live MCP. They are all retained. The original literal is stored as a Vercel Secret and is not returned by read endpoints; this is a reconciliation of the complete supported provider family, not a claim that an unreadable secret was copied byte for byte. Preserve the existing production-only target and Secret type. Preview global MCP policy is unchanged. No credential, permission, price cell, paid attempt or broader model gate is changed.

Environment settings are deployment snapshots. Apply this policy to the existing production variable, then qualify a fresh normal Git deployment of this follow-up. An update to project settings alone is not a receipt that already-running code received the value. Keep the ordinary PR, required CI, exact Git Preview admission and premerge alignment gates; do not use a local upload or manual production promotion.

After Git production is READY, read both domains and live MCP again. Nano21 must expose `t2i`/`i2i`, generation enabled and the native reference contract; all four existing image models must remain admitted. Recheck the six approved 7/11/23-cent public quotes, App/Studio discovery and final F source binding. No paid canary is implied.

## Rollback

Remove only `nano-banana-2-1` from the five-engine policy and deliver that setting through the same Git path. This restores the four observed previous effective admissions. Do not disable the global Vertex image provider or edit credentials, tariffs, the public media collection or other engine identities. The engine remains individually closable by its ordinary explicit allowlist and publication gates.
