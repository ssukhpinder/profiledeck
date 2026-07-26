# Contributing to ProfileDeck

Thank you for helping improve ProfileDeck. Contributions should preserve the
project's central promise: profiles make ProfileDeck's own routing choices more
explicit without claiming to replace native authentication, permissions, or
workspace policy.

By submitting a contribution, you agree that it may be distributed under the
[MIT License](LICENSE).

## Development setup

Requirements:

- Node.js 20 or newer
- pnpm 11.9.0
- Git

Install and verify:

```bash
git clone https://github.com/ssukhpinder/profiledeck.git
cd profiledeck
pnpm install --frozen-lockfile
pnpm check
```

Run the HTTP transport during development:

```bash
pnpm dev:http
```

Build only the plugin's bundled stdio server:

```bash
pnpm build:plugin
```

Generated bundles must be produced by the build scripts rather than edited by
hand.

## Choose an issue

For a substantial feature or behavior change, open an issue before investing in
an implementation. Explain:

- The user problem.
- The supported ChatGPT Work or Codex surface.
- The profile, skill, connector, and operation involved.
- Any new data, permission, authentication, or privacy implications.

Keep pull requests focused. Refactors unrelated to the proposed behavior should
be separate.

## Design rules

Contributions must preserve these boundaries:

1. A profile is a routing preference, not a user identity or security boundary.
2. ProfileDeck cannot toggle or revoke unrelated installed connectors.
3. Native host and connector authentication, authorization, policy, and
   confirmations always apply.
4. Personal versus Work must be selected explicitly, not inferred from message
   contents.
5. Profiles must never store secrets, raw conversations, or connector payloads.
6. Existing contexts retain their pinned profile snapshot and revision.
7. Updating an existing profile requires its current revision; creating a new
   profile may omit revision.
8. Tool descriptions, schemas, and safety annotations must match actual behavior.

## Tests

Every behavior change should include tests at the narrowest useful level:

- Policy tests for allow, confirm, and deny decisions.
- Store tests for revisions, context snapshots, expiry, deletion, and atomic
  persistence.
- MCP contract tests for schemas, annotations, valid inputs, and invalid inputs.
- Regression tests for security and privacy bugs.

Before opening a pull request, run:

```bash
pnpm check
```

The same command runs in continuous integration.

## Skills and documentation

Keep skill descriptions specific enough for ChatGPT Work and Codex to select the
right workflow. Avoid instructions that:

- Claim ProfileDeck changes product settings or account identity.
- Infer a profile from sensitive content.
- Weaken host confirmations.
- Treat connector labels as verified account identities.
- Place large reference material directly in `SKILL.md` when a focused reference
  file is more appropriate.

Update user documentation, privacy disclosures, the threat model, and
`CHANGELOG.md` whenever behavior or data handling changes.

## Commit and pull request guidance

Use clear, imperative commit subjects. A pull request should include:

- A concise summary and linked issue.
- The test plan and `pnpm check` result.
- User-visible examples when routing behavior changes.
- Manifest, tool-schema, or annotation changes called out explicitly.
- Storage migration and backward-compatibility notes when applicable.
- Privacy and security impact.

Reviewers may request a smaller change, additional negative tests, or clearer
boundary language before merging.

## Reporting security issues

Do not open a public issue or pull request containing an unpatched
vulnerability. Follow [SECURITY.md](SECURITY.md).
