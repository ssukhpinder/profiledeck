# Default fallback profiles

Use these canonical defaults only when the ProfileDeck MCP server is unavailable. Fallback
selection and routing last for the current conversation only; they do not persist or create
an enforceable connector boundary.

## Personal

- Skill: `personal-assistant`, enabled, priority 100.
- Connector: `google-calendar`, instance label `Personal calendar`.
- Allowed Calendar operations: `read`, `draft`.
- Calendar activation: `explicit_only`.
- Unknown capability: `ask`.
- Approvals: reads and drafts follow native policy; writes and sends always ask; deletes block.

## Work

- Skill: `work-assistant`, enabled, priority 100.
- Connector: `github`, instance label `Work organization`.
- Allowed GitHub operations: `read`, `draft`.
- GitHub activation: `when_relevant`.
- Connector: `slack`, instance label `Work workspace`.
- Allowed Slack operations: `read`, `draft`, `send`.
- Slack activation: `explicit_only`.
- Unknown capability: `block`.
- Approvals: reads and drafts follow native policy; writes and sends always ask; deletes block.

Instance labels are reminders, not verified account identities. Before external activity,
identify the actual account, workspace, repository, channel, recipient, and destination.

## Manual fallback evaluation

Before a profile-specific capability:

1. Match the skill or connector and operation against the selected default above.
2. Apply `block` before any confirmation rule.
3. For an `explicit_only` connector, require the user to name or confirm the connector and
   destination.
4. Apply the profile approval rule.
5. Require explicit confirmation for every connector delete.
6. Preserve all native authentication, workspace, and confirmation requirements.

An allowed fallback route is still advisory and never authorizes a connector call.

Custom profiles have no canonical fallback. Without MCP, use one only when the user supplies
the complete profile definition in the current conversation and explicitly asks to apply it
temporarily. Validate it against the documented profile format, do not persist it, and do not
claim the route is enforced outside this workflow.
