# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security concern.**

Report privately through
[GitHub Security Advisories](https://github.com/ayesigapaul/orchestra/security/advisories/new).

**There is no email channel.** A dedicated address will be published once the project has a domain
it controls. Until then Security Advisories is the only private route, and no address should be
inferred — one that cannot receive mail is worse than none, because a report sent to it is lost
rather than refused.

Please include: what you found, how to reproduce it, the affected component and version, and the
impact you believe it has.

### What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement | 3 working days |
| Initial assessment | 10 working days |
| Fix or mitigation plan | 30 days for High and Critical |
| Public disclosure | Coordinated, after a fix is available |

We will credit reporters who wish to be credited. We ask for coordinated disclosure and will not
pursue good-faith research conducted within this policy.

## Scope

This repository currently contains architecture and specification documents. Reports against the
**design** are in scope and welcome — a flaw in a specification is cheaper to fix here than in an
implementation.

Particularly valuable:

- Weaknesses in the policy enforcement model
- Prompt injection and tool poisoning paths not covered by the threat model
- Credential custody design under BYOK
- Tenant isolation gaps
- Connector trust boundary and enrolment weaknesses
- Confused-deputy conditions in tool authorization

## Design principles we hold ourselves to

- Enterprise credentials are never exposed to client bundles, logs, traces, event payloads or
  backups.
- High-consequence actions require human authorisation enforced by policy, not by prompt.
- Every policy decision is audited, including allows.
- Deny by default: an agent holds only capabilities explicitly granted.
- Tenant isolation is enforced at the storage layer, never only in application code.
