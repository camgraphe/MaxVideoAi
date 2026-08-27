# Support without exposing private work

Choose the channel by what you need to share. Public issues are appropriate only for sanitized, reproducible package problems. Account, billing, and private-media questions belong in private support.

```text
Public: sanitized package bug or compatibility report
Private: account, billing, customer media, or sensitive context
Security: private vulnerability disclosure only
```

## Where do setup and usage questions go?

Start with the [setup guides](docs/claude.md), [Codex guide](docs/codex.md), [ChatGPT guide](docs/chatgpt.md), [generic MCP guide](docs/generic-mcp.md), and [troubleshooting](docs/troubleshooting.md). If the answer is not there, use the [private contact page](https://maxvideoai.com/contact) or email [support@maxvideoai.com](mailto:support@maxvideoai.com).

**Example**: Ask private support to review an account-specific connection problem without publishing account details.

## Where do bugs and compatibility reports go?

Use the structured bug issue for a reproducible package defect. Use the compatibility report for host installation, OAuth, tool discovery, planning, or quote-boundary evidence. Check the [current compatibility evidence](https://maxvideoai.com/docs/mcp) before filing.

Security reports do not belong in issues. Follow [SECURITY.md](SECURITY.md) and email [security@maxvideoai.com](mailto:security@maxvideoai.com) privately.

## What diagnostics are safe to share publicly?

Include only:

- host/client name and exact version;
- operating system and version;
- plugin package version or tag;
- setup or installation path;
- approximate UTC time;
- sanitized reproduction steps;
- the visible safe error text;
- whether the flow stopped during planning, quote preparation, or after approval, without an amount or billing detail.

```text
Safe example: Codex [exact version], macOS [version], plugin tag [tag], approximate UTC time, sanitized steps, visible safe error.
```

Do not include tokens, passwords, cookies, authorization codes, email addresses, full private or proprietary prompts, private job IDs, private URLs, customer media, billing data, or payment information. Redact screenshots and logs before attaching them.

## What must use private support?

Billing, account access, email-address changes, private media, customer prompts, private job context, and payment questions must use private support through the [MaxVideoAI contact page](https://maxvideoai.com/contact), never a public issue.

## When should I expect a reply?

This project makes no response-time guarantee. Clear routing and sanitized evidence help the team review a report, but there is no promised acknowledgement or resolution window.

Last reviewed: 2026-08-28.
