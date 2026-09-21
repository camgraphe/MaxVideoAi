# MCP and plugin updates

Created and reviewed: **2026-09-22**. Owner: MaxVideoAI engineering.

## Two independent updates

The remote server at `https://api.maxvideoai.com/mcp` owns live tools, schemas,
model facts and execution. Deploying it updates the service for every connected
host. Clients can retain discovered metadata in an existing conversation; start
a new conversation or use the host's supported refresh/reconnect action when
the inventory is stale. Reauthenticate only when the host reports that need.

The installed plugin owns local skills and reference documents. A server deploy
does not replace these files. The host must retrieve a new plugin package and
load it. Never promise identical automatic updates across Codex, Claude Code,
Claude's remote connectors and managed organization marketplaces.

## Codex: reviewed version or published branch

Use the current app's plugin manager or its verified bundled CLI. The terminal
binary may be older than the app. Inspect `codex --version` and the installed
version with `codex plugin list --json` before diagnosing an update problem.

For an installation pinned to a reviewed release, select the **new** release tag,
then start a fresh task. Codex CLI `0.155.0-alpha.9.2` treats a changed Git ref as
a different source and requires removing the named marketplace source first.
The verified update from `0.3.5` to `0.3.6` uses:

```sh
codex plugin marketplace remove maxvideoai
codex plugin marketplace add camgraphe/maxvideoai-plugin --ref v0.3.6
codex plugin add maxvideoai@maxvideoai
```

Use this removal only for that source replacement; do not remove other
marketplaces or revoke the account connection. Check the current CLI's help
before applying these commands to a different host/version.
`codex plugin marketplace upgrade maxvideoai` refreshes the configured source;
it does not turn an immutable old release tag into a newer one.

A user or organization that deliberately chooses to follow the published
`main` branch can refresh that source and reinstall the named plugin:

```sh
codex plugin marketplace upgrade maxvideoai
codex plugin add maxvideoai@maxvideoai
```

The dedicated public repository's `main` contains published packages, not the
application's development branch. Changing an existing customer's tracking
choice is a separate setting decision; do not silently move pinned installs.
The refresh command is explicit, not a guarantee of background updates in every
Codex build. Verify the resulting version and a no-spend live call.

Keep the configured marketplace source as the tagged Git repository or the
deliberately selected published branch. Never register a transient build folder.
An existing cache may still load after such a folder disappears, hiding a broken
update path. Repair the source with the supported marketplace command; do not
edit caches, erase unrelated marketplaces or discard the user's creative brief.

## Claude remote connector

The custom remote connector uses the deployed server. There is no local
MaxVideoAI archive to replace for that connection. If tools stay stale, use the
connector controls and a fresh conversation. Keep this route distinct from a
Claude Code plugin installation and from an organization-managed plugin.

## Claude Code plugin

In `/plugin`, open **Marketplaces**, select the MaxVideoAI marketplace, then
enable auto-update if the user wants it. Anthropic documents auto-update as
disabled by default for third-party marketplaces. When enabled, updates happen
in the background after startup; the current session may still use its loaded
version until `/reload-plugins` or the next launch.

Manual marketplace refresh is available through `/plugin marketplace update
maxvideoai`; update the installed plugin through its plugin controls and verify
the resulting version. A source pinned to an immutable tag remains pinned.
These are documented host behaviors, not a completed Claude Code lifecycle test
of this release.

## Managed organizations and ZIP imports

Organization GitHub synchronization and installation policies are controlled by
the workspace administrator. A manual ZIP import needs a replacement ZIP; it
does not inherit the behavior of a Git-backed marketplace. Use the actual
host's update/sync controls and record the retrieved version.

## Release checklist

1. Publish the reviewed source through the protected release workflow; verify
   the public ZIP checksum and matching tag.
2. Deploy and verify the remote server independently of the package.
3. Update the official MCP Registry record independently; it is discovery
   metadata, not a client-side plugin updater.
4. Test an existing installation's update and a fresh no-spend task. Record the
   host version, plugin version, discovered tool and result separately.
5. Keep compatibility claims scoped to the hosts and actions actually exercised.
   Never infer automatic installation, OAuth success or paid generation from a
   published version number alone.

## Sources reviewed on 2026-09-22

- [OpenAI: plugin marketplace sources and refresh](https://developers.openai.com/plugins/build/plugins).
- [Claude Code: configure auto-updates](https://code.claude.com/docs/en/discover-plugins#configure-auto-updates).
- [Claude: organization marketplace synchronization](https://support.claude.com/en/articles/13837433-manage-plugins-for-your-organization).
- The locally verified Codex CLI help and release-specific execution evidence
  distinguish commands supported by this machine from host-wide promises.
