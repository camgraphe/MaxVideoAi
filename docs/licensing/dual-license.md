# Dual Licensing Playbook

MaxVideoAI distributes public code under the Business Source License 1.1 (BUSL 1.1) while offering a paid commercial licence for partners. This document captures the operating model.

## Licence Matrix

| Capability | BUSL 1.1 (public repo) | Commercial licence (partners) |
|------------|------------------------|--------------------------------|
| Source access | Full product (read-only, subject to BUSL restrictions) | Full product + premium assets/tools |
| Usage rights | Non-production, internal evaluation | Commercial deployment, SaaS resale, sublicensing |
| Change Date | 10 Oct 2028 → Apache 2.0 | N/A – governed by contract |
| Trademark use | Not permitted without approval | “Powered by MaxVideoAI” branding allowed per contract |
| Support | Community/Best effort | SLA-backed support & roadmap alignment |

## Deliverables per Track

- **BUSL community build**
  - Repo: `maxvideoai`.
  - Artifacts: full codebase under BUSL (non-production rights), sample configs, mock data.
  - Documentation: README + NOTICE + link to BUSL text.

- **Commercial build**
  - Delivery: access to the public repo plus premium packages (`@maxvideoai-pro/*`) and managed deployment assets.
  - Artifacts: hardened configs, advanced orchestration, governance tooling.
  - Extras: onboarding guide, environment templates, support channel.

## Contract Checklist (Commercial)

1. **Grant of licence**: non-exclusive, world-wide, allows commercial hosting and derivative works.  
2. **Restrictions**: no sublicensing beyond agreed scope, attribution requirement, confidentiality.  
3. **Fees**: annual licence fee + optional revenue share.  
4. **Support**: response times, escalation path, dedicated Slack/Email.  
5. **Updates**: access to premium packages and managed releases, semantic versioning policy.  
6. **Termination**: breach cure period, data deletion, survival clauses.  
7. **Audit clause**: ability to verify compliance (logs or self-certification).  
8. **Governing law** & venue.

## Operational Flow

1. **Lead qualification** → confirm need for commercial licence.  
2. **NDA (optional)** → share roadmap/private docs.  
3. **Licence offer** → send collateral summarising benefits (pricing, support).  
4. **Contract signature** (e-sign).  
5. **Provisioning** → grant customer access to premium packages/support portal, invite to support channel, deliver onboarding package.  
6. **Quarterly review** → confirm compliance, assess upsell opportunities.

## Packaging Options

- **Managed SaaS**: deploy from vendor-managed environment; customer consumes API with no code access.  
- **Self-hosted**: ship Docker images / Helm charts signed per release.  
- **SDK distribution**: publish to private registry with licence checks (e.g. licence key validation in init).

## Future Automation Ideas

- Licence portal issuing signed tokens that unlock premium builds.  
- GitHub Action that verifies customer forks remain private and up to date.  
- Billing integration (Stripe) tied to licence renewal reminders.
