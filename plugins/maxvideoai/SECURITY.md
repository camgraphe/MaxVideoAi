# Security

## Which version is supported?

Only the latest published MaxVideoAI plugin release is supported. The package contains no embedded access secret, OAuth token, model catalogue, pricing table, or customer data. Authentication is completed directly with MaxVideoAI over OAuth.

```text
Supported: latest published plugin release
Disclosure: private email only
Public vulnerability issue: do not open
```

## How do I report a vulnerability?

Report suspected vulnerabilities privately to [security@maxvideoai.com](mailto:security@maxvideoai.com). Do not open a public vulnerability issue, discussion, or pull request, and do not add a sensitive attachment to a public report.

Include only the affected package version, host and version, sanitized reproduction, security impact, and safe logs. Include no credentials, private media, payment data, authorization material, customer prompts, private URLs, or account details.

**Example**: Describe the impact and minimum sanitized reproduction privately; replace sensitive values with clear redaction markers.

The project does not promise a fixed acknowledgement or remediation window. Disclosure timing is coordinated according to the validated impact and a safe release path.

## How do I verify a release?

Each release includes a SHA-256 file for the ZIP archive and a `checksums.json` file for every packaged source file. Compare both before installing an archive obtained outside the official MaxVideoAI GitHub release.

## Where do non-security questions go?

Use [SUPPORT.md](SUPPORT.md) for setup, compatibility, account, billing, and private-media routing. Conduct reports follow the private process in the [Code of Conduct](CODE_OF_CONDUCT.md).

Last reviewed: 2026-08-28.
