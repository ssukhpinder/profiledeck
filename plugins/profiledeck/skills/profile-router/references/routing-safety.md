# Routing safety

ProfileDeck narrows its own routing choices. It cannot enforce an allowlist over unrelated
native tools or other installed plugins.

For every route:

1. Require an explicit profile selection.
2. Identify the connector instance and destination.
3. Deny a capability absent from a `block` profile.
4. Ask before using an unknown capability in an `ask` profile.
5. Preserve all native authentication and confirmation requirements.
6. Never treat tool annotations as authorization.
7. Require explicit confirmation for every connector `delete`, even when the profile says
   `follow_native`.
8. Keep Personal and Work data separate. Recommend a new chat when switching contexts could
   mix them.

If hard isolation is required, expose the provider through a ProfileDeck-owned MCP adapter
and enforce user, tenant, profile, resource, and operation checks server-side. Do not claim
hard isolation for advisory routing to independently installed connectors.
