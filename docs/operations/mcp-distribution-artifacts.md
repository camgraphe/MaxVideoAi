# MCP distribution artifacts

Checked: **2026-09-13**

This guide records local, reviewable distribution candidates. It grants no
external write. Publication always requires a fresh policy recheck and explicit
owner authorization for the exact artifact.

## ClawHub candidate

The local candidate contains exactly:

- `distribution/clawhub/maxvideoai/SKILL.md`
- `distribution/clawhub/maxvideoai/references/safe-generation.md`
- `distribution/clawhub/maxvideoai/.clawhubignore`

It is a text-only guide for the existing authenticated remote MCP endpoint. It
installs no executable code, requests no environment variable, stores no
credential, and duplicates no model roster, price, provider rule, or billing
logic. Its only runtime permission is the OpenClaw-managed MCP access that the
user separately grants to MaxVideoAI through OAuth.

ClawHub's current skill terms apply MIT-0 to published skills. On 2026-09-13,
the product owner explicitly accepted that consequence for exactly the two
publishable payload files, `SKILL.md` and `references/safe-generation.md`.

### Primary-source recheck

Rechecked 2026-09-13 against ClawHub's current first-party
[publishing](https://github.com/openclaw/clawhub/blob/main/docs/publishing.md),
[CLI](https://github.com/openclaw/clawhub/blob/main/docs/cli.md), and
[skill-format](https://github.com/openclaw/clawhub/blob/main/docs/skill-format.md)
documentation:

- `clawhub skill publish <path> --dry-run` resolves a skill publication without
  uploading it; a real first publication defaults to `1.0.0` unless an exact
  version is supplied;
- publishing requires access to the selected personal or organization owner;
  the owner-controlled personal publisher account was verified as `@camgraphe`
  before upload;
- every published skill is licensed under MIT-0, allowing use, modification,
  and redistribution without attribution; the repository's BUSL-1.1 license
  does not override those ClawHub copies;
- all regular files not excluded by ignore rules may enter the artifact, so the
  CLI's resolved file list remains authoritative even though the current local
  tree contains only the three reviewed files;
- security scans run after upload and may hold or hide a release; current CLI
  scan commands operate on a version already uploaded to the registry rather than a local
  path;
- install, update, and uninstall maintain local ClawHub lock/origin state;
  uninstall removes the local skill but does not establish revocation of the
  separate MaxVideoAI OAuth grant.

The authoritative 2026-09-13 dry-run used the official npm package
`clawhub@0.23.3` from `openclaw/clawhub`, requiring Node 22 or newer. Its npm
integrity was
`sha512-VwM6FQrZVarFRDiEqG42npUeyCu/iLhPnpO+b7kKIGRXv+TA6Lb8pboHnIgT6cmjFEnW3j/pTbshWeDQMQ7QWQ==`.
The CLI was executed ephemerally with `npm exec`; it was not installed globally.

The exact non-uploading command resolved `maxvideoai`, display name
`MaxVideoAI`, and version `1.0.0` with status `would-publish`, `fileCount: 2`,
and fingerprint
`d7cca882cf7561fcc8bc83d3f5c130d060beb132bfab98871ed219ccfbfa79dd`.
The two publishable payload files are `SKILL.md` and
`references/safe-generation.md`. `.clawhubignore` is the third reviewed local
file but is a packaging control, not a published payload file. A disposable
variant without `.clawhubignore` produced the same file count and fingerprint;
removing `safe-generation.md` reduced the count to one and changed the
fingerprint. All three local files are non-executable ASCII text with Git mode
`100644`; the payload audit found no credential, installer, fixed price, or
copied model roster.

At `2026-09-13T20:59:22Z`, the official CLI confirmed the owner-controlled
publisher handle `@camgraphe`. A fresh authenticated dry-run resolved the
intended public slug `maxvideoai`, reported `latestVersion: null`, and reproduced
the same two-file fingerprint above.

### Published listing

After explicit authorization for this exact upload, ClawHub accepted version
`1.0.0` with version ID `k971k3r0c1yhhcx7arvk6a11e58eb3gv`, two payload files,
and the unchanged fingerprint
`d7cca882cf7561fcc8bc83d3f5c130d060beb132bfab98871ed219ccfbfa79dd`.
The public listing is
[clawhub.ai/camgraphe/skills/maxvideoai](https://clawhub.ai/camgraphe/skills/maxvideoai),
owned by `@camgraphe`; it exposes version `1.0.0`, the `latest` tag, and MIT-0.
The canonical listing returned HTTP 200 after ClawHub's redirect.

ClawHub's stored moderation result is `clean` with legacy reason
`scanner.llm.clean`, no suspicious flag, and no malware block. The additional
read-only scan completed successfully as scan
`w17cqj7rwt42xmjz4gh24zb9t18ebpax`: static analysis and A.I.G were clean with
zero findings, and ClawScan returned `clean` / `benign` with high confidence.
Skillspector separately reported three heuristic findings because the guide
mentions an access credential in a prohibition, connects to the declared
external MaxVideoAI MCP endpoint, and says never to ask for credentials. Those
signals are recorded rather than hidden; ClawScan classified the first two as
expected and the last as a context mismatch because the guide requires explicit
approval before paid confirmation.

A clean package lifecycle using the same ephemeral `clawhub@0.23.3` installed
`maxvideoai` version `1.0.0` into a disposable directory. SHA-256 comparison
proved both installed payload files were byte-identical to the reviewed local
files. The exact-version update correctly reported it was already at `1.0.0`,
and uninstall removed the skill. The disposable directory was then removed.
This package lifecycle did not create, exercise, or revoke a MaxVideoAI OAuth
grant.

### Local validation

Run the repository contract first. When the current ClawHub CLI is available,
preview the resolved file set without uploading it:

```bash
npm exec --yes --package=clawhub@0.23.3 -- clawhub skill publish \
  "$PWD/distribution/clawhub/maxvideoai" \
  --slug maxvideoai \
  --name MaxVideoAI \
  --version 1.0.0 \
  --dry-run \
  --json
```

Review the resolved files, metadata, requested permissions, source provenance,
license consequence, category/topic rules, and scan policy. A skill first
published without categories is placed in `other`; any final category/topic
choice must use current allowed values and avoid reserved endorsement terms.
The local contract does not replace this CLI validation.

### Clean-host end-to-end proof still required

The isolated ClawHub install, exact-version update, and uninstall lifecycle is
complete. A separate clean OpenClaw 2026.9.4 profile also installed
`@camgraphe/maxvideoai` version `1.0.0`, recognized the Skill Card as eligible
and model-visible, completed browser OAuth, and exposed all 15 protected
capabilities without a diagnostic. Clearing the OAuth credentials made the next
probe fail closed with authorization required; the Skill, MCP entry, and profile
were then removed. The headless `agent exec` path did not reuse the profile's MCP
OAuth state, so an agent-mediated protected tool call from the installed Skill
remains unverified.

Record the remaining agent-mediated call, private-reference lifecycle, channel
rendering, and limitations when those end-to-end proofs are run. The ClawHub
listing and tested direct-MCP scope support the live, indexable,
acquisition-enabled OpenClaw page; the remaining paths stay outside the claim.
