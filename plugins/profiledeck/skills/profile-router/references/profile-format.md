# Profile format

ProfileDeck profiles contain routing preferences, not credentials.

Required fields:

- `id`: stable lowercase identifier.
- `revision`: positive integer. Omit it only when creating a profile through `save_profile`;
  include the current revision for every update.
- `name` and `description`: user-facing labels.
- `instructions.context`: short behavioral guidance.
- `instructions.dataHandling`: rules for moving or exposing information.
- `capabilities.skills`: allowed skill IDs.
- `capabilities.connectors`: allowed connector IDs, optional instance labels, allowed
  operation classes, and activation behavior.
- `capabilities.unknownCapability`: `block` or `ask`.
- `approvals`: policy for `read`, `draft`, `write`, `send`, and `delete`.

Profiles must never contain OAuth tokens, cookies, API keys, session IDs, raw chat
transcripts, or connector response payloads. Treat an instance label as descriptive only;
the connector host remains responsible for account identity and authorization.

Use `explicit_only` activation when account identity or destination is easy to confuse.
Use `always_ask` for externally visible writes. Use `block` for destructive operations by
default.
