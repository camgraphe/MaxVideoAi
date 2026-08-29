# Publishing the MaxVideoAI plugin repository

This runbook publishes the reviewed plugin surface from `camgraphe/MaxVideoAi` to
`camgraphe/maxvideoai-plugin`. The product repository is the only authored source.
The dedicated repository is a generated distribution surface for installation,
releases, discovery, issues, and Discussions.

No command in this document authorizes creating the public repository, changing
repository settings, adding a secret, pushing a tag, or publishing a release.
Obtain the owner approval required by the GitHub commercial-presence plan before
each external mutation.

## Current release state — 2026-08-29

The focused repository now contains public package history:

- [v0.3.0](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.0) is public with `maxvideoai-plugin-0.3.0.zip` and its `.sha256` attachment;
- [v0.3.1](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.1) is public with `maxvideoai-plugin-0.3.1.zip` and its `.sha256` attachment;
- [v0.3.2](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.2) is public with `maxvideoai-plugin-0.3.2.zip` and its `.sha256` attachment;
- [v0.3.3](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.3) is public with `maxvideoai-plugin-0.3.3.zip` and its `.sha256` attachment. It corrects the durable release wording and focused public-repository install path.

These facts prove public distribution for v0.3.0 through v0.3.3. The successful
v0.3.3 workflow and clean Codex package installation from the public tag do not
prove a clean install or complete execution path in every host.

## Publication contract

The release chain is intentionally narrow:

```text
maxvideoai-plugin-v<version> source tag
  -> deterministic bundle and SHA-256 manifest
  -> temporary checkout of camgraphe/maxvideoai-plugin
  -> exact-file synchronization and visible Git diff
  -> normal, non-force commit and push
  -> v<version> public release with ZIP and SHA-256 attachment
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

The workflow uses the `maxvideoai-plugin-publication` GitHub Environment. Recheck
that environment's intended owner/reviewer and release-tag deployment restriction
before the next workflow-driven publication. Its unprotected `prepare` job has no
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

## Next candidate publication

The following sequence applies to every future candidate only after its named gate
is complete. The existence of earlier public releases does not waive a new
version's evidence requirements.

1. Complete the explicit external-mutation approval. Confirm the owner, repository
   name, public visibility, description, homepage, version, and exact bundle
   inventory with the owner.
2. Confirm that `camgraphe/maxvideoai-plugin` still uses `main`, contains the exact
   bootstrap marker, and has no unexpected files or remote drift.
3. Recheck repository settings, the publication environment, and the scoped
   `MAXVIDEOAI_PLUGIN_REPO_TOKEN`. Apply the bootstrap protection stage described
   below; do not invent a required check or use an administrator token to make a
   run pass.
4. Complete the coordinated release version in `plugins/maxvideoai/VERSION`, the
   Codex and Claude manifests, marketplace metadata, and changelog. Run the plugin,
   content, asset, and release-bundle checks.
5. Create the source tag only on the reviewed release commit. Its name must be
   `maxvideoai-plugin-v<semver>` and its version must equal `VERSION` exactly.
6. Push the source tag, then manually dispatch `Publish MaxVideoAI plugin repository`
   with that existing tag. The explicit dispatch prevents an incomplete publication
   when the cross-repository token is not configured. Use the same tag as both the
   workflow ref and input so the Environment's tag restriction remains effective:

   ```bash
   release_version="<approved-semver>"
   gh workflow run publish-maxvideoai-plugin.yml \
     --repo camgraphe/MaxVideoAi \
     --ref "maxvideoai-plugin-v${release_version}" \
     -f "source_tag=maxvideoai-plugin-v${release_version}"
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

At original bootstrap, the repository contained only the marker. The current
destination still has no pull-request workflow with an observed required check.
Do not claim required status checks are active and do not add a required check that
GitHub has never run. Such a rule would block the mirror's normal direct
fast-forward push without adding a valid review path.

Until the pull-request validation path exists, protect `main` against deletion and
force pushes while allowing the scoped publication token's ordinary fast-forward
push after Environment approval. This is not an administrator bypass: the token
follows the configured rule and has no repository-administration permission.

Migrate to required checks only after the destination repository has a compatible
pull-request validation workflow. Change publication to open a generated release
PR, observe the exact destination check name, require that check on `main`, and merge
through the reviewed PR path. Do not enable a blocking direct-push rule before that
migration is implemented and exercised.

## Release creation

When a closed candidate passes every gate, source tag
`maxvideoai-plugin-v<version>` makes the workflow create destination release
`v<version>` at the newly published commit. It attaches:

- `maxvideoai-plugin-<version>.zip`;
- `maxvideoai-plugin-<version>.zip.sha256`.

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
| Original bootstrap tree | `.maxvideoai-public-repository` only |
| Description and homepage | Approved commercial description; `https://maxvideoai.com/mcp` |
| Topics | `ai-video`, `video-generation`, `mcp`, `model-context-protocol`, `chatgpt`, `claude`, `codex`, `ai-agents` |
| Community settings | Issues and Discussions enabled; Wiki disabled; merge commits disabled; squash merge enabled; merged branches deleted |
| Bootstrap `main` protection | Force pushes and branch deletion disabled; no invented required status check or pull-request gate |
| Security | Secret scanning, push protection, and private vulnerability reporting enabled |
| Social preview | [GitHub-hosted repository image](https://repository-images.githubusercontent.com/1349419332/e5459224-cdf9-433c-9ccb-44034079a51f) from `assets/social/github-social-preview.png`, 1280×640, SHA-256 `a77684b5c02980246a50df2ae6ae5247d9bd6c03b1dd1f4a2d997c89fee98e07` |
| Source Environment | `maxvideoai-plugin-publication`; owner review required; deployments restricted to `maxvideoai-plugin-v*` tags |
| Publication secret | Repository Actions secret `MAXVIDEOAI_PLUGIN_REPO_TOKEN` was installed on 2026-08-29 from a fine-grained token limited to the destination repository with Contents read/write; the value is not recorded |
| Public releases | [v0.3.0](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.0) through [v0.3.3](https://github.com/camgraphe/maxvideoai-plugin/releases/tag/v0.3.3) are public, each with a ZIP and SHA-256 attachment |
| Latest publication workflow | Source workflow [run 33223071787](https://github.com/camgraphe/MaxVideoAi/actions/runs/33223071787) published source commit `c4045a55` to public commit `c677ed53` for v0.3.3 |
| Latest release checksum | Public `maxvideoai-plugin-0.3.3.zip` SHA-256 is `af6d6f4e124e3c6abe95ada4cb0049fa9c843bb1eb58dd6b874abce5c4e5413b`; the attached checksum verifies successfully |
| Latest clean install | Codex CLI added `camgraphe/maxvideoai-plugin#v0.3.3`, installed `maxvideoai@maxvideoai` 0.3.3, and exposed the corrected README and guide |
| Closed candidate | None after the v0.3.3 closeout; any future candidate requires a new coordinated version and complete gate |

The welcome Discussion and destination required checks remain separate follow-up
work. Public artifacts are installable-release evidence for their versions only,
not native-host compatibility or end-to-end generation evidence.

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
