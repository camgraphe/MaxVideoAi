# MCP distribution artifacts

Checked: **2026-09-13**

This guide records local, reviewable distribution candidates. It grants no
external write. Publication always requires a fresh policy recheck and explicit
owner authorization for the exact artifact.

## ClawHub candidate

The candidate contains exactly:

- `distribution/clawhub/maxvideoai/SKILL.md`
- `distribution/clawhub/maxvideoai/references/safe-generation.md`
- `distribution/clawhub/maxvideoai/.clawhubignore`

It is a text-only guide for the existing authenticated remote MCP endpoint. It
installs no executable code, requests no environment variable, stores no
credential, and duplicates no model roster, price, provider rule, or billing
logic. Its only runtime permission is the OpenClaw-managed MCP access that the
user separately grants to MaxVideoAI through OAuth.

ClawHub's current skill terms apply MIT-0 to published skills. The product owner
must accept that consequence for the exact files before any external action.

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
  owner and namespace checks remain account-specific and unverified here;
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

This recheck is read-only. The ClawHub CLI is not installed, no owner namespace
was inspected, and no dry-run, sign-in, scan, upload, or publication occurred.

### Local validation

Run the repository contract first. When the current ClawHub CLI is available,
preview the resolved file set without uploading it:

```bash
clawhub skill publish distribution/clawhub/maxvideoai --slug maxvideoai --name MaxVideoAI --version 1.0.0 --dry-run
```

Review the resolved files, metadata, requested permissions, source provenance,
license consequence, category/topic rules, and scan policy. A skill first
published without categories is placed in `other`; any final category/topic
choice must use current allowed values and avoid reserved endorsement terms.
The local contract does not replace this CLI validation.

### Clean-host lifecycle still required

On a disposable OpenClaw environment, inspect the candidate, install it, verify
its generated Skill Card, connect the remote MCP through OAuth, exercise the
bounded workflow, update it from an exact version, and uninstall it. Confirm
that uninstalling the skill does not revoke the separate MaxVideoAI grant and
that revoking the grant prevents protected MCP calls.

Record the exact OpenClaw and ClawHub versions, file digest, install/update/
uninstall result, scan state, OAuth lifecycle, quote boundary, accepted-job
recovery, and limitations. Until those checks and explicit owner authorization
are complete, the registry state remains local preparation only.
