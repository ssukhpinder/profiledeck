# Profile format

ProfileDeck profiles are JSON routing policies. They contain instructions and
capability identifiers, never credentials or connector data.

Complete examples are available at:

- `plugins/profiledeck/examples/personal.profile.json`
- `plugins/profiledeck/examples/work.profile.json`

## Top-level fields

| Field | Requirements | Meaning |
| --- | --- | --- |
| `id` | Lowercase kebab case, maximum 64 characters | Stable profile identifier. |
| `revision` | Positive integer | Stored version used for optimistic updates. |
| `name` | 1–80 characters | User-facing name. |
| `description` | 1–240 characters | Concise intended use. |
| `instructions` | Object | Behavioral context and data-handling rules. |
| `capabilities` | Object | ProfileDeck skill and connector routing policy. |
| `approvals` | Object | Per-operation approval behavior. |

An ID must match:

```text
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

## Revision behavior

The stored form always contains `revision`.

- A new profile may omit `revision` when passed to `save_profile`; the server
  creates revision `1`.
- Updating an existing profile must include the exact current revision.
- A successful update increments the revision by one.
- A missing revision on an update is rejected.
- A stale revision is rejected rather than overwriting a newer update.

Open contexts pin the complete profile snapshot and revision. Editing a profile
therefore affects new contexts only.

## Instructions

```json
{
  "instructions": {
    "context": "Use concise professional communication.",
    "dataHandling": [
      "Do not route client data into Personal connectors."
    ]
  }
}
```

- `context` is behavioral guidance up to 1,500 characters.
- `dataHandling` contains up to 20 rules, each up to 300 characters.

Do not place secrets, raw chats, connector results, or sensitive data used only
for classification in either field.

## Skills

```json
{
  "id": "work-assistant",
  "enabled": true,
  "priority": 100
}
```

- `id` identifies a skill known to the ProfileDeck workflow.
- `enabled` defaults to `true`.
- `priority` is an integer from 0 through 100 and defaults to 50.

Skill IDs must be unique within a profile, and the list may contain at most 100 entries.
Listing a skill does not install or enable it in the host.

## Connectors

```json
{
  "connectorId": "slack",
  "instanceLabel": "Work workspace",
  "allowedOperations": ["read", "draft", "send"],
  "activation": "explicit_only"
}
```

- `connectorId` identifies a route the ProfileDeck workflow recognizes.
- `instanceLabel` is a human-readable reminder, not verified account identity.
- `allowedOperations` contains one or more unique operation classes.
- `activation` is `when_relevant` or `explicit_only`.

Use `explicit_only` when an account, workspace, repository, channel, recipient,
or destination could be confused. Connector IDs must be unique within a profile, and a
connector list may contain at most 100 entries.

ProfileDeck cannot install, connect, disconnect, enable, disable, or revoke an
independently installed connector.

## Operation classes

| Operation | Typical meaning |
| --- | --- |
| `read` | Retrieve or inspect data without changing it. |
| `draft` | Prepare content without publishing or sending it. |
| `write` | Create or update persistent data. |
| `send` | Deliver or publish externally visible content. |
| `delete` | Remove data or perform a difficult-to-reverse action. |

Classify the actual effect, not the tool's marketing name.

## Approval rules

Every operation has one of:

- `follow_native`: ProfileDeck adds no extra confirmation; host policy still applies, except
  that `delete` retains a ProfileDeck confirmation floor.
- `always_ask`: ProfileDeck returns `confirm`.
- `block`: ProfileDeck returns `deny`.

Recommended defaults:

- Reads and drafts: `follow_native`.
- Writes and sends: `always_ask`.
- Deletes: `block`.

## Unknown capabilities

`capabilities.unknownCapability` is:

- `block`: deny a capability absent from the profile.
- `ask`: require confirmation for a one-time override or offer to switch
  profiles.

An override is advisory within that routed workflow. It does not alter the
stored profile or grant connector permissions.

## Minimal custom profile

```json
{
  "id": "study",
  "name": "Study",
  "description": "Research and learning without external writes.",
  "instructions": {
    "context": "Explain concepts clearly and preserve source links.",
    "dataHandling": [
      "Do not send or publish content."
    ]
  },
  "capabilities": {
    "skills": [
      {
        "id": "personal-assistant",
        "enabled": true,
        "priority": 80
      }
    ],
    "connectors": [],
    "unknownCapability": "ask"
  },
  "approvals": {
    "read": "follow_native",
    "draft": "follow_native",
    "write": "block",
    "send": "block",
    "delete": "block"
  }
}
```

This is valid input for creating a profile because `revision` may be omitted.
After creation, retain the returned revision and include it in later updates.
