# Publishing the MaxVideoAI plugin repository

This runbook publishes the reviewed plugin surface from `camgraphe/MaxVideoAi` to
`camgraphe/maxvideoai-plugin`. The product repository is the only authored source.
The dedicated repository is a generated distribution surface for installation,
releases, discovery, issues, and Discussions.

No command in this document authorizes creating the public repository, changing
repository settings, adding a secret, pushing a tag, or publishing a release.
Obtain the owner approval required by the GitHub commercial-presence plan before
the first external mutation.

## Publication contract

The release chain is intentionally narrow:

```text
maxvideoai-plugin-v0.3.0 source tag
  -> deterministic bundle and SHA-256 manifest
  -> temporary checkout of camgraphe/maxvideoai-plugin
  -> exact-file synchronization and visible Git diff
  -> normal, non-force commit and push
  -> v0.3.0 public release with ZIP and SHA-256 attachment
```

`plugins/maxvideoai/` remains the only place to edit plugin content. Never edit a
generated public file to prepare a release. Apply the change in the product
repository, run its contracts, and publish a new version.

The public checkout must already contain a real `.git` directory and this exact
bootstrap marker before the synchronizer can write:

```json
{"repository":"camgraphe/maxvideoai-plugin","schemaVersion":1}
```

Save it as `.maxvideoai-public-repository` with a trailing newline. The mirror
preserves `.git` and this marker. Every other public path must match the verified
release bundle exactly; obsolete files are removed.

## Token and environment

Create a fine-grained GitHub token limited to the single destination repository,
`camgraphe/maxvideoai-plugin`. Grant only:

- repository access to `camgraphe/maxvideoai-plugin`;
- `Contents: Read and write`, which is required for the commit, tag, and release;
- the implicit read-only metadata permission.

Do not grant organization administration, workflows, issues, discussions, or
access to other repositories. Store the token in the source repository's Actions
settings as the secret `MAXVIDEOAI_PLUGIN_REPO_TOKEN`. Never place it in a local env
file, workflow argument, release note, artifact, or public repository.

The workflow uses the `maxvideoai-plugin-publication` GitHub Environment. Configure
that environment with the intended owner/reviewer and restrict deployment branches
to release tags before first publication. Its unprotected `prepare` job has no
secret: it builds and synchronizes into a temporary checkout, stages the result,
prints `git diff --cached --check`, the stat, and the complete diff, then records
the public base SHA and Git tree. Only after those logs exist does the protected
`publish` job request Environment approval. It rebuilds from the same source tag
and must reproduce both the base SHA and tree before the scoped token can push.

## Local dry run

Run dry runs from the root of `camgraphe/MaxVideoAi`. Use only disposable paths.
The release builder validates the explicit allowlist, assets, public text, versions,
archive determinism, and checksums before the mirror reads the bundle.

```bash
publication_tmp="$(mktemp -d)"
publication_tmp="$(cd "$publication_tmp" && pwd -P)"
node scripts/build-maxvideoai-plugin-release.mjs \
  --source plugins/maxvideoai \
  --out "$publication_tmp/release"
git clone https://github.com/camgraphe/maxvideoai-plugin.git \
  "$publication_tmp/public"
node scripts/sync-maxvideoai-plugin-repository.mjs \
  --source "$publication_tmp/release/maxvideoai-plugin" \
  --target "$publication_tmp/public" \
  --dry-run
```

The JSON report lists the version, exact file count, files that would be written,
and obsolete files that would be removed. `--dry-run` does not modify the checkout.
Delete the disposable directory after review using the operating system's normal
temporary-file cleanup or a carefully verified explicit path.

For a fully local rehearsal, initialize a temporary Git repository and add the
exact marker above. Never point the synchronizer at the product repository, the
workspace root, the home directory, a symlink, or an unresolved path. It refuses
all of them by design.

## First publication

1. Complete the explicit external-mutation approval in Task 10. Confirm the owner,
   repository name, public visibility, description, homepage, version, and exact
   bundle inventory with the owner.
2. Create `camgraphe/maxvideoai-plugin` with `main` as its default branch. Its first
   commit must contain only `.maxvideoai-public-repository` with the exact content
   above.
3. Configure repository settings, the publication environment, and the scoped
   `MAXVIDEOAI_PLUGIN_REPO_TOKEN`. Apply the bootstrap protection stage described
   below; do not invent a required check or use an administrator token to make the
   first run pass.
4. Complete the coordinated release version in `plugins/maxvideoai/VERSION`, the
   Codex and Claude manifests, marketplace metadata, and changelog. Run the plugin,
   content, asset, and release-bundle checks.
5. Create the source tag only on the reviewed release commit. Its name must be
   `maxvideoai-plugin-v<semver>` and its version must equal `VERSION` exactly.
6. Push the source tag or manually dispatch `Publish MaxVideoAI plugin repository`
   with that existing tag. A manual dispatch must use the same tag as both its
   workflow ref and input so the Environment's tag restriction remains effective:

   ```bash
   gh workflow run publish-maxvideoai-plugin.yml \
     --repo camgraphe/MaxVideoAi \
     --ref maxvideoai-plugin-v0.3.0 \
     -f source_tag=maxvideoai-plugin-v0.3.0
   ```

   Dispatching from `main` while naming a tag only in the input is rejected.
7. Inspect the workflow's sync report, Git status, diff check, diff summary, source
   SHA, destination commit, archive digest, and release URL. Record this evidence in
   the launch/publication record.

The workflow clones the destination into the runner's temporary directory. It
captures `origin/main` before synchronization, fetches it again before pushing, and
fails if the remote changed. The final push is a normal fast-forward push. A race
after the second fetch still fails as a non-fast-forward update; there is no force
push fallback.

## Main protection rollout

The bootstrap repository contains only the marker and has no destination-side pull
request workflow with an observed check yet. At this stage, do not claim required
status checks are active and do not add a required check that GitHub has never run.
Such a rule would block the mirror's normal direct fast-forward push without adding
a valid review path.

For bootstrap releases, protect `main` against deletion and force pushes while
allowing the scoped publication token's ordinary fast-forward push after Environment
approval. This is not an administrator bypass: the token follows the configured
rule and has no repository-administration permission.

Migrate to required checks only after the destination repository has a compatible
pull-request validation workflow. Change publication to open a generated release
PR, observe the exact destination check name, require that check on `main`, and merge
through the reviewed PR path. Do not enable a blocking direct-push rule before that
migration is implemented and exercised.

## Release creation

For source tag `maxvideoai-plugin-v0.3.0`, the workflow creates destination release
`v0.3.0` at the newly published commit. It attaches:

- `maxvideoai-plugin-0.3.0.zip`;
- `maxvideoai-plugin-0.3.0.zip.sha256`.

The ZIP is the deterministic archive from the source build, while the public tree
contains the same release files plus `checksums.json`. Verify the attached archive
against the `.sha256` file and verify sampled public files against
`checksums.json`. The synchronizer calculates every post-copy digest from the target
checkout against the already validated manifest; it does not trust a second read of
the mutable source directory.

Before release creation, the workflow resolves an existing destination tag,
including the peeled commit of an annotated tag. It refuses the release if
`v<version>` points anywhere except the prepared public commit. A same-commit tag is
allowed, but an existing GitHub release is still never replaced. Never move or
recreate a published semantic version; fix the source and issue the next patch
version.

## Bootstrap evidence — 2026-08-28

The owner approved the external repository mutation immediately before creation.
The verified bootstrap state is:

| Evidence | Verified state |
| --- | --- |
| Public repository | [`camgraphe/maxvideoai-plugin`](https://github.com/camgraphe/maxvideoai-plugin) |
| Default branch | `main` |
| Bootstrap commit | `82885191f0743641fd04c9ac5cd7a862087ed35a` |
| Bootstrap tree | `.maxvideoai-public-repository` only |
| Description and homepage | Approved commercial description; `https://maxvideoai.com/mcp` |
| Topics | `ai-video`, `video-generation`, `mcp`, `model-context-protocol`, `chatgpt`, `claude`, `codex`, `ai-agents` |
| Community settings | Issues and Discussions enabled; Wiki disabled; merge commits disabled; squash merge enabled; merged branches deleted |
| Bootstrap `main` protection | Force pushes and branch deletion disabled; no invented required status check or pull-request gate |
| Security | Secret scanning, push protection, and private vulnerability reporting enabled |
| Social preview | [GitHub-hosted repository image](https://repository-images.githubusercontent.com/1349419332/e5459224-cdf9-433c-9ccb-44034079a51f) from `assets/social/github-social-preview.png`, 1280×640, SHA-256 `a77684b5c02980246a50df2ae6ae5247d9bd6c03b1dd1f4a2d997c89fee98e07` |
| Source Environment | `maxvideoai-plugin-publication`; owner review required; deployments restricted to `maxvideoai-plugin-v*` tags |
| Publication secret | `MAXVIDEOAI_PLUGIN_REPO_TOKEN` not configured: the active CLI credential is broader than the required single-repository token and was deliberately not reused |
| Public package, tag, workflow run, release | Not published; `0.3.0` remains gated on the coordinated metadata, version, content, token, and final review |

The welcome Discussion, release pin, destination required checks, and first mirror
run remain deferred until the reviewed `0.3.0` package is ready. This bootstrap is
public infrastructure evidence, not an installable-release or host-compatibility
claim.

## Failure and rollback

If validation, checkout, synchronization, or the remote-drift guard fails, nothing
should be pushed. Read the first failing check, fix the authored source or reconcile
the destination history, rebuild, and dispatch the same unpublished source tag.
Do not bypass the marker, edit the generated bundle, or force push.

If a public commit has already shipped and must be withdrawn:

1. identify the exact destination commit and corresponding source SHA;
2. revert that commit in `camgraphe/maxvideoai-plugin` with a normal `git revert`;
3. review and push the revert through the protected `main` branch;
4. mark the affected release clearly in its notes and stop recommending it;
5. fix the authored source and publish a new patch version.

Keep the reverted commit and release history reviewable. Do not delete history,
retag the broken version, force push, or patch the public repository by hand.

## Ownership summary

| Surface | Role | May be edited directly? |
| --- | --- | --- |
| `camgraphe/MaxVideoAi/plugins/maxvideoai/` | Authored plugin source | Yes, through normal review |
| Source release tag | Immutable reviewed input | No; create a new version |
| Deterministic bundle | Validated build output | No |
| `camgraphe/maxvideoai-plugin` public files | Generated distribution mirror | No |
| Public issues and Discussions | Support and community conversation | Yes |
| `.maxvideoai-public-repository` | Persistent write-safety marker | Bootstrap only |

Pull requests that change generated public files should be redirected to the source
repository. This keeps fixes reviewable once, prevents mirror drift, and gives every
public release a reproducible source commit.
