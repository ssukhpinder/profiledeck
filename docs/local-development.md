# Local development

## Prerequisites

- Node.js 20 or newer
- pnpm 10.34.0
- Git
- A supported ChatGPT Work or Codex plugin surface for end-to-end plugin tests

## Install and check

```bash
git clone https://github.com/ssukhpinder/profiledeck.git
cd profiledeck
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` is the required pre-commit and CI command. It runs:

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm build`
4. `pnpm validate`

## Development HTTP server

```bash
pnpm dev:http
```

Defaults:

- MCP endpoint: `http://127.0.0.1:3000/mcp`
- Health endpoint: `http://127.0.0.1:3000/healthz`
- Data file: `~/.profiledeck/profiles.json`

The HTTP transport accepts MCP requests only with `POST /mcp`. `GET /mcp` and
`DELETE /mcp` return `405`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PROFILEDECK_DATA_FILE` | `~/.profiledeck/profiles.json` | Profile and context state file. |
| `PROFILEDECK_HOST` | `127.0.0.1` | HTTP bind host. |
| `PROFILEDECK_PORT` | `3000` | HTTP bind port. |
| `PROFILEDECK_ALLOWED_HOSTS` | SDK defaults | Comma-separated HTTP host allowlist. |
| `PROFILEDECK_ALLOW_INSECURE_HTTP` | Unset | Set to `1` to permit a non-loopback bind. This adds no security. |
| `OPENAI_APPS_CHALLENGE` | Unset | Plain-text domain verification token returned by the well-known endpoint. |

PowerShell example with an isolated development store:

```powershell
$env:PROFILEDECK_DATA_FILE = "$PWD\.profiledeck\dev-profiles.json"
$env:PROFILEDECK_PORT = "3100"
pnpm dev:http
```

POSIX shell example:

```bash
PROFILEDECK_DATA_FILE="$PWD/.profiledeck/dev-profiles.json" \
PROFILEDECK_PORT=3100 \
pnpm dev:http
```

## Inspect the MCP endpoint

Start the server, then run MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

Select Streamable HTTP and connect to `http://127.0.0.1:3000/mcp`. Verify:

- Initialization and server instructions.
- All eight tools and their safety annotations.
- Valid and invalid inputs.
- Missing, expired, and closed contexts.
- Missing and stale profile revisions.
- Allow, confirm, and deny routing decisions.

Use a disposable `PROFILEDECK_DATA_FILE` while testing mutations.

## Build the plugin

```bash
pnpm build:plugin
```

This bundles `server/src/stdio.ts` into
`plugins/profiledeck/mcp/server.mjs`. The plugin's `.mcp.json` launches that
file with Node.js.

Do not edit the generated bundle by hand.

## Install the local plugin

The repository contains `.agents/plugins/marketplace.json` and
`plugins/profiledeck`.

1. Build the plugin.
2. Open the repository as the active workspace in ChatGPT desktop or Codex.
3. Refresh the app.
4. Open **Plugins**, choose **ProfileDeck Development**, and install ProfileDeck.
5. Start a new chat or Codex session.

ProfileDeck does not run in regular Chat.

Codex can start the bundled stdio MCP server and use persistent profile contexts.
ChatGPT Work can load the skills, but this repository has no registered ChatGPT
MCP connection. In Work, expect conversation-scoped fallback routing for the canonical
Personal and Work defaults until a
public HTTPS endpoint is deployed, registered, and mapped through `.app.json`.
See [deployment.md](deployment.md).
Custom profiles are not persisted in fallback mode.


For Codex CLI, use `/plugins`. If needed, register the repository root:

```bash
codex plugin marketplace add /absolute/path/to/profiledeck
codex plugin add profiledeck@profiledeck-dev
```

After skill, manifest, MCP configuration, or bundled-server changes, rebuild and
reinstall the plugin. Start a new session because plugin components are loaded at
session boundaries.

## Build the HTTP artifact

```bash
pnpm build:http
pnpm start:http
```

The output is `dist/profiledeck-http.mjs`.

## Test isolation and revisions

Useful manual sequence:

1. Open Work and retain its context ID.
2. Read Work and retain revision `1`.
3. Save an update with revision `1`; expect revision `2`.
4. Try the same update again with revision `1`; expect a conflict.
5. Inspect the original context; expect its Work snapshot to remain revision `1`.
6. Open another Work context; expect revision `2`.

This verifies both optimistic concurrency and snapshot pinning.

## Troubleshooting

### The plugin is visible but its tools are missing

Run `pnpm build:plugin`, reinstall from the marketplace, and start a new session.
Confirm `plugins/profiledeck/mcp/server.mjs` exists.

### A context is missing

Contexts expire after their configured TTL and can be closed explicitly. Select
the profile again to open a new context.

### An update reports a revision conflict

Call `get_profile`, apply the intended change to the current document, and submit
the current revision. Do not retry by deleting the revision.

### Non-loopback HTTP bind is refused
That refusal is intentional because the server has no production
authentication. Keep it on loopback for development. Read
[deployment.md](deployment.md) before using the override.
