# Public plugin submission readiness

Status: **not ready for public submission**

ProfileDeck has a combined skills-and-MCP architecture suitable for continued
development, but the repository does not include a production deployment or a
registered ChatGPT connection.

## Support matrix

| Surface | Bundled skills | Persistent MCP contexts | Current path |
| --- | --- | --- | --- |
| Codex in the desktop app | Yes | Yes | Build and install the bundled stdio server. |
| Codex CLI | Yes | Yes | Build and install through the repository marketplace. |
| ChatGPT desktop, Work | Yes | Not by default | Skills manually apply canonical Personal/Work fallback policy until a public HTTPS MCP connection is registered and mapped. |
| Regular Chat | No | No | Unsupported plugin surface. |

The repository intentionally contains no `.app.json` and no `apps` manifest
field. Add them only after a real ChatGPT developer-mode connection exists.

## Implemented foundations

- Required `.codex-plugin/plugin.json`.
- Profile-router, Personal, and Work skills.
- Local marketplace for testing.
- Bundled stdio server for Codex.
- Streamable HTTP endpoint at `POST /mcp`.
- Tool titles, descriptions, schemas, and annotations.
- Domain challenge endpoint.
- Public repository, privacy, terms, support, security, and license documents.
- Policy, persistence, and MCP metadata tests.
- Explicit profile selection, snapshot pinning, and revision-checked updates.

## Blocking work

Before submission:

- Deploy a stable public HTTPS Streamable HTTP endpoint.
- Add OAuth 2.1 user authentication for the customer-specific, state-changing service.
- Enforce user and tenant authorization for every tool.
- Replace the shared JSON file with tenant-keyed transactional storage.
- Add rate limits, request-size limits, operational monitoring, and deletion
  workflows.
- Verify developer or business identity in the OpenAI Platform.
- Ensure the submitter has Apps Management write access.
- Register and verify the production domain.
- Produce production-ready logo and listing assets.
- Provide reviewer credentials without MFA, email, SMS, or private-network
  requirements if authentication is required.
- Validate public website, support, privacy, and terms URLs against the verified
  publisher identity.
- Run the final evaluation set against the deployed endpoint.

Do not submit a localhost URL, temporary tunnel, or existing integration
reference.

## Tool review matrix

| Tool | Read-only | Destructive | Idempotent | Open world |
| --- | ---: | ---: | ---: | ---: |
| `list_profiles` | Yes | No | Yes | No |
| `get_profile` | Yes | No | Yes | No |
| `save_profile` | No | Yes | No | No |
| `delete_profile` | No | Yes | Yes | No |
| `open_profile` | No | No | No | No |
| `get_profile_context` | Yes | No | Yes | No |
| `close_profile_context` | No | Yes | Yes | No |
| `evaluate_route` | Yes | No | Yes | No |

Recheck this table against the scanned production metadata before every
submission. Changing published tool names, descriptions, schemas, or annotations
requires a new scan and reviewed metadata version.

## Required positive tests

Reviewers should be able to run these without internal knowledge:

1. **Select Personal**
   - Request: switch to Personal.
   - Expected: `open_profile` returns a context pinned to Personal and states its
     revision.
2. **Allow a Personal Calendar read**
   - Request: explicitly read the Personal calendar.
   - Expected: `evaluate_route` returns `allow`, while retaining the native
     authorization reminder.
3. **Select Work and read GitHub**
   - Request: switch to Work and inspect an allowed GitHub route.
   - Expected: Work context opens and a GitHub `read` can be allowed.
4. **Confirm a Work Slack send**
   - Request: explicitly send to a named Work Slack channel.
   - Expected: `evaluate_route` returns `confirm` before any external connector
     action.
5. **Update with the current revision**
   - Request: read a custom profile, change its description, and save using the
     returned revision.
   - Expected: save succeeds at the next revision; an already-open context keeps
     its prior snapshot.

## Required negative tests

1. **No selected profile**
   - Request: evaluate a route without a valid context.
   - Expected: `PROFILE_REQUIRED`; the workflow asks the user to choose a
     profile.
2. **Stale profile update**
   - Request: update an existing profile using an older revision.
   - Expected: revision conflict; newer state remains unchanged.
3. **Disallowed Work write**
   - Request: use GitHub `write` through the default Work profile.
   - Expected: `deny`; no external connector action is attempted.

Also test an expired context, invalid profile schema, unknown capability, delete
confirmation, and attempted profile content containing a credential.

## Listing materials

Prepare and review:

- Customer-facing name: ProfileDeck.
- Short and long descriptions that describe routing, not account isolation.
- Production logo and category.
- Verified developer identity.
- Website and support URLs.
- Privacy policy and terms URLs.
- Three concise starter prompts.
- Supported country and region list.
- Initial release notes.
- Five positive and three negative tests.

Listing language must say that ProfileDeck routes its own plugin capabilities and
cannot toggle unrelated connectors or act as an authentication boundary.

## Submission flow

1. Complete security and deployment blockers.
2. Deploy and test the production MCP endpoint.
3. Serve and verify the domain challenge token.
4. Scan tools in the submission portal.
5. Compare scanned schemas and annotations with this repository.
6. Upload the final skill tree and listing materials.
7. Run all evaluation cases using reviewer-equivalent access.
8. Complete policy attestations and submit for review.
9. After approval, choose when to publish.

Publication makes the approved listing available through the universal plugin
directory on supported ChatGPT and Codex surfaces; it does not add support to
regular Chat.
