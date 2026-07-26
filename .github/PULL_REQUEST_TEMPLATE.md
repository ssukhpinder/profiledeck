## Summary

Describe the user-visible outcome and link the related issue.

## Test plan

- [ ] `pnpm check` passes locally.
- [ ] Tests cover the changed behavior and relevant invalid inputs.
- [ ] I tested a new chat or Codex session when plugin components changed.

## ProfileDeck boundaries

- [ ] The change does not claim profiles are identities or authorization boundaries.
- [ ] The change does not claim ProfileDeck toggles or revokes unrelated connectors.
- [ ] Native authentication, workspace policy, and confirmations remain authoritative.
- [ ] Existing contexts retain pinned snapshots; profile edits affect new contexts.
- [ ] Existing profile updates require the current revision.

## Security and release review

- [ ] I called out tool name, schema, description, or annotation changes.
- [ ] I called out manifest, MCP configuration, or marketplace changes.
- [ ] I updated privacy, security, deployment, and user documentation where needed.
- [ ] I added a changelog entry for user-visible behavior.
- [ ] The change does not add secrets, credentials, private profile content, or connector data.

## Additional evidence

Include sanitized output, screenshots, compatibility notes, or migration details
when they materially help review.
