# Security Policy

## Supported versions

Security fixes are made on the default branch and included in the next release.
Only the latest published release receives security fixes. Older releases and
modified third-party deployments are not supported by the project.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability.

Use
[GitHub Private Vulnerability Reporting](https://github.com/ssukhpinder/profiledeck/security/advisories/new)
to send the maintainer:

- The affected version or commit.
- The affected transport: stdio, HTTP, or both.
- A concise impact statement.
- Reproduction steps or a minimal proof of concept.
- Suggested remediation, if available.

Redact credentials, tokens, profile contents, conversation text, connector
payloads, and third-party personal information. Test only accounts and systems
you own or are authorized to assess.

## Response targets

These are good-faith targets rather than service-level guarantees:

- Acknowledge a complete report within three business days.
- Provide an initial severity assessment within seven business days.
- Coordinate a disclosure date after a fix is available.
- Credit the reporter when requested and appropriate.

The project does not currently operate a bug-bounty program.

## In scope

Examples include:

- Reading or changing another user's or tenant's profile data.
- Escaping the configured profile data path.
- Profile revision checks that can be bypassed to overwrite newer data.
- Contexts that fail to preserve their pinned profile snapshot.
- Injection that changes a route without user-visible confirmation.
- A tool annotated as read-only that changes state.
- Leakage of credentials, profile content, or MCP results through logs or errors.
- Authentication, authorization, CSRF, origin, or tenant-isolation failures in
  the HTTP transport.
- Dependency or release-artifact compromise.

## Important boundary

ProfileDeck profiles are routing preferences, not authentication or
authorization boundaries. ProfileDeck cannot disable unrelated connectors,
revoke OAuth grants, override workspace policy, or prevent another plugin from
using its own tools.

A report that only demonstrates those documented limitations is not a
ProfileDeck vulnerability. A report is in scope when ProfileDeck behaves
contrary to its documented routing rules, crosses a data boundary it claims to
enforce, or creates a vulnerability in the host environment.

## Deployment security

The repository is local-first. Do not expose the HTTP server as a public
multi-user service without:

- HTTPS and trusted proxy configuration.
- Authentication and server-side authorization.
- Tenant-scoped storage and queries.
- Rate and request-size limits.
- Secret management and log redaction.
- Backup, retention, deletion, and incident-response procedures.

See [docs/threat-model.md](docs/threat-model.md) and
[docs/deployment.md](docs/deployment.md).
