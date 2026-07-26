# ProfileDeck

ProfileDeck is an open-source plugin for selecting a Personal, Work, or custom
profile before a task. Each profile describes which ProfileDeck skills and
connector routes are appropriate, which operations are allowed, and when the
user must confirm a route.

> [!IMPORTANT]
> ProfileDeck supports plugin surfaces in **ChatGPT Work** and **Codex**, including
> those surfaces in the ChatGPT desktop app. It does not add profiles to regular
> Chat, and it does not change ChatGPT account settings, memory, identity, or
> workspace membership.

ProfileDeck narrows the capabilities that its own workflow may choose. It cannot
install, enable, disable, connect, disconnect, or revoke unrelated connectors.
A ProfileDeck decision is not authorization: the host and connector still enforce
authentication, workspace policy, permissions, sandboxing, and confirmation
requirements.

## Status

ProfileDeck is an early-stage, local-first `0.1.0` project. The repository includes:

- A universal plugin package under `plugins/profiledeck`.
- A profile-router skill plus Personal and Work workflow skills.
- A local MCP server bundled into the plugin over stdio.
- A Streamable HTTP build for development and deployment.
- Versioned profiles and short-lived contexts that pin profile snapshots.
- Default Personal and Work example profiles.

The project does not currently provide a hosted ProfileDeck service.

## Support matrix

| Surface | ProfileDeck skills | Persistent profile contexts |
| --- | --- | --- |
| Codex in the ChatGPT desktop app | Supported | Supported through the bundled stdio MCP server after `pnpm build:plugin`. |
| Codex CLI | Supported | Supported through the bundled stdio MCP server after `pnpm build:plugin`. |
| ChatGPT desktop, Work | Supported | Conversation-scoped fallback only in this repository. Persistent MCP contexts require a deployed HTTPS endpoint and registered ChatGPT connection. |
| Regular Chat | Not supported | Not supported. |

The repository does **not** include a registered ChatGPT MCP connection,
`.app.json`, or `apps` manifest mapping. Those are deployment-specific and can be
added only after registering a real HTTPS Streamable HTTP endpoint in ChatGPT
developer mode. See [Deployment](docs/deployment.md).


## How it works

1. The user explicitly selects a profile.
2. ProfileDeck opens a context pinned to that profile's current revision and snapshot.
3. Before a ProfileDeck skill or connector route is used, the router evaluates the
   proposed skill, connector, operation, and destination.
4. The router returns `allow`, `confirm`, or `deny`.
5. The host still applies all native authorization and confirmation behavior.

Contexts deliberately keep their original snapshot. Editing a profile affects new
contexts only; an existing context continues to use the revision it opened with.

## Requirements

- Node.js 20 or newer
- pnpm 11.9.0
- A supported ChatGPT Work or Codex plugin surface for plugin testing

## Build and verify

```bash
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs type-checking, tests, both server builds, and repository
validation.

Available scripts:

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | Type-check the TypeScript server. |
| `pnpm test` | Run policy, storage, and MCP contract tests. |
| `pnpm build:plugin` | Bundle the stdio server into the plugin package. |
| `pnpm build:http` | Bundle the deployable Streamable HTTP server. |
| `pnpm build` | Build both server variants. |
| `pnpm dev:http` | Run the HTTP server from TypeScript in development. |
| `pnpm start:http` | Run the compiled HTTP server. |
| `pnpm licenses:generate` | Regenerate bundled third-party license notices. |
| `pnpm licenses:check` | Verify that committed notices match production dependencies. |
| `pnpm validate` | Validate the plugin, marketplace, skills, and generated artifacts. |
| `pnpm check` | Run the complete local and CI verification sequence. |

## Install from the local marketplace

First build the bundled MCP server:

```bash
pnpm install --frozen-lockfile
pnpm build:plugin
```

The repository includes a local marketplace at
`.agents/plugins/marketplace.json`. Open this repository as the active workspace
in the ChatGPT desktop app or Codex, refresh the app, then:

1. Select ChatGPT **Work** or **Codex**.
2. Open **Plugins**.
3. Choose **ProfileDeck Development**.
4. Install and enable **ProfileDeck**.
5. Start a new chat or Codex session.


In Codex, the built plugin can start its bundled stdio MCP server and persist
profiles and contexts.

In ChatGPT Work, this repository installs the bundled skills but has no
registered MCP connection. The profile-router therefore manually applies its bundled
canonical Personal or Work policy for the current conversation. This fallback does not
persist selections or custom profiles. Persistent ChatGPT contexts require deploying the
HTTP server, registering it in ChatGPT developer mode, and adding the resulting
connection mapping.

In Codex CLI, use `/plugins` to browse the marketplace and install ProfileDeck.
If the repository marketplace is not already discovered, add the absolute
repository root as a local marketplace:

```bash
codex plugin marketplace add /absolute/path/to/profiledeck
codex plugin add profiledeck@profiledeck-dev
```

Local plugin installs are cached. After changing the plugin, rebuild it, reinstall
it from the same marketplace, and start a new chat or CLI session so the updated
skills and MCP tools are loaded.

## Try it

Example prompts:

```text
Switch to my Personal profile.
```

```text
Switch to Work and show the allowed ProfileDeck capabilities.
```

```text
Using my Work profile, check whether a GitHub read is allowed.
```

```text
Create a Study profile based on Personal, but do not allow connector writes.
```

ProfileDeck never infers Personal versus Work from message contents. If no profile
is named, the profile-router skill asks the user to choose one. Creating,
updating, or persisting profiles requires an available ProfileDeck MCP
connection. Fallback mode is conversation-scoped and supports the canonical Personal and
Work defaults; a custom profile requires MCP or a complete definition explicitly supplied
for temporary use in that chat.

## Profile model

A profile contains:

- Behavioral and data-handling instructions.
- Allowed ProfileDeck skill IDs.
- Connector IDs and descriptive instance labels.
- Allowed operation classes: `read`, `draft`, `write`, `send`, and `delete`.
- Activation rules for connector routes.
- Approval rules and an unknown-capability policy.

New profiles may omit `revision`; the server creates them at revision `1`.
Updates must include the current revision and are rejected if another update has
already advanced it. Successful updates increment the revision.

Profiles must not contain passwords, OAuth tokens, cookies, API keys, raw
conversation text, or connector payloads. See
[Profile format](docs/profile-format.md) for the complete schema and examples.

## Data storage

By default, the server stores profiles and context snapshots in:

```text
~/.profiledeck/profiles.json
```

Set `PROFILEDECK_DATA_FILE` to use a different file. The server creates the file
with restrictive permissions where the operating system supports them. Contexts
expire and are pruned; profiles remain until explicitly deleted. See
[Privacy](PRIVACY.md) and [Architecture](docs/architecture.md).

## HTTP development and deployment

Run the development transport:

```bash
pnpm dev:http
```

Or build and run the production artifact:

```bash
pnpm build:http
pnpm start:http
```

The HTTP transport is useful for local MCP inspection and as a deployment base.
Do not expose a local-first build as a public multi-user service without
authentication, tenant isolation, TLS, rate limiting, durable storage, secret
management, and a deployment-specific privacy policy. See
[Deployment](docs/deployment.md).

## Project layout

```text
.agents/plugins/marketplace.json   Local development marketplace
plugins/profiledeck/               Installable plugin package
  .codex-plugin/plugin.json        Plugin manifest
  .mcp.json                        Bundled MCP server configuration
  skills/                          Router, Personal, and Work skills
  examples/                        Example profile documents
server/src/                        Profile store, policy, and MCP transports
server/test/                       Unit and contract tests
docs/                              Architecture, format, deployment, and review docs
scripts/                           Build, license, and repository validation tools
THIRD_PARTY_LICENSES.txt           Bundled dependency license texts and notices
```

## Important limitations

- Profiles route ProfileDeck capabilities; they are not separate identities or
  security boundaries.
- A connector instance label is descriptive. It does not prove which external
  account is authenticated.
- ProfileDeck cannot prevent a user or another plugin from invoking an unrelated
  installed connector.
- ProfileDeck does not alter ChatGPT memory or retroactively remove information
  already present in a conversation.
- Switching profiles applies to future work. Start a new chat when Personal and
  Work context could otherwise become mixed.

## Contributing and support

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Use
[GitHub Issues](https://github.com/ssukhpinder/profiledeck/issues) for reproducible
bugs and focused feature proposals. See [SUPPORT.md](SUPPORT.md) for help and
[SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License and independence

ProfileDeck is licensed under the [MIT License](LICENSE).

Bundled dependencies retain their own licenses and notices in
[THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).

ProfileDeck is an independent, unofficial project. OpenAI, ChatGPT, and Codex are
trademarks of OpenAI, L.L.C. This project is not affiliated with, endorsed by,
sponsored by, or an official product of OpenAI. See [NOTICE.md](NOTICE.md).
