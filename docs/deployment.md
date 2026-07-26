# HTTP deployment

ProfileDeck includes a Streamable HTTP build so maintainers can inspect, deploy,
and register its MCP server. The current server is a local-first deployment
base, not a production-ready public multi-user service.

## Current security posture

The HTTP server currently has:

- No user authentication.
- No tenant identity or tenant-scoped authorization.
- One JSON state file shared by the process.
- No distributed locking or multi-replica coordination.
- No built-in TLS termination.
- No application-level rate limiting.

It binds to `127.0.0.1` by default. A non-loopback bind is refused unless
`PROFILEDECK_ALLOW_INSECURE_HTTP=1`.

> [!WARNING]
> The override only disables the bind safeguard. It does not enable TLS,
> authentication, authorization, tenant isolation, or any other security
> control. Do not expose the current server directly to the public internet.

## Build and run

```bash
pnpm install --frozen-lockfile
pnpm build:http
pnpm start:http
```

The build output is `dist/profiledeck-http.mjs`.

## Endpoints

| Method and path | Purpose |
| --- | --- |
| `POST /mcp` | Streamable HTTP MCP requests. |
| `GET /healthz` | Health response with server version. |
| `GET /.well-known/openai-apps-challenge` | Plain-text domain verification token when configured. |
| `GET /mcp` | Returns `405 Method Not Allowed`. |
| `DELETE /mcp` | Returns `405 Method Not Allowed`. |

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `PROFILEDECK_HOST` | `127.0.0.1` | Bind address. |
| `PROFILEDECK_PORT` | `3000` | Integer from 1 through 65,535. |
| `PROFILEDECK_ALLOWED_HOSTS` | SDK defaults | Comma-separated allowed HTTP host names. |
| `PROFILEDECK_ALLOW_INSECURE_HTTP` | Unset | Must be `1` for a non-loopback bind; adds no security. |
| `PROFILEDECK_DATA_FILE` | `~/.profiledeck/profiles.json` | Persistent state path. |
| `OPENAI_APPS_CHALLENGE` | Unset | Exact token for the well-known verification response. |

## Private single-instance deployment

A controlled development deployment can place ProfileDeck behind a TLS reverse
proxy and an access-control layer:

```bash
PROFILEDECK_HOST=0.0.0.0 \
PROFILEDECK_PORT=3000 \
PROFILEDECK_ALLOWED_HOSTS=profiledeck.example.com \
PROFILEDECK_ALLOW_INSECURE_HTTP=1 \
PROFILEDECK_DATA_FILE=/var/lib/profiledeck/profiles.json \
node dist/profiledeck-http.mjs
```

The reverse proxy must:

- Terminate HTTPS.
- Authenticate every request.
- Strip untrusted forwarding headers.
- Preserve Streamable HTTP request and response behavior.
- Restrict request size and rate.
- Avoid logging authorization headers, bodies, or MCP results.
- Forward only the intended host name to ProfileDeck.

Use one application process and one writable durable volume. The file lock prevents
lost updates between local processes sharing exactly one data path, but the JSON store
does not provide distributed transactions, tenant isolation, or safe multi-replica
coordination.

This topology can be useful for an authorized single-user or controlled
development environment. A generic proxy login does not by itself make the
server suitable for public plugin submission.

## ChatGPT Work developer-mode connection

The repository does not include a registered ChatGPT MCP connection or an
`.app.json` mapping.

Persistent ProfileDeck contexts in ChatGPT Work require:

1. A reachable HTTPS Streamable HTTP endpoint at `/mcp`.
2. ChatGPT developer mode enabled.
3. The MCP endpoint registered as a connection in ChatGPT.
4. The resulting `plugin_asdk_app...` connection ID mapped through `.app.json`.
5. `apps: "./.app.json"` added to the plugin manifest only when that file
   actually exists.
6. The plugin rebuilt, reinstalled, and tested in a new Work chat.

Use the Codex `plugin-creator` workflow to create the mapping from the real
registered connection ID. Do not commit credentials, reviewer accounts, or
deployment secrets. Without this mapping, the ChatGPT Work skills can still use
conversation-scoped fallback routing for the canonical Personal and Work defaults, but they
cannot persist MCP contexts or custom profiles. A temporary custom fallback requires the
complete definition in the conversation.

Codex can use the bundled `.mcp.json` stdio server directly after
`pnpm build:plugin`.

## Production and multi-user requirements

Before operating ProfileDeck for multiple users, replace or extend the current
HTTP layer with:

- OAuth 2.1 user authentication appropriate to the ChatGPT MCP client.
- Server-side user and tenant authorization on every tool.
- Tenant-keyed transactional storage.
- Encryption at rest and managed encryption keys.
- Database migrations and rollback.
- Request limits, abuse controls, and timeouts.
- Auditable administrative access.
- Data export, deletion, backup, and retention procedures.
- Redacted logs, metrics, alerts, and incident response.
- A deployment-specific privacy policy, terms, and support process.

Do not trust a profile ID, context ID, user ID, or tenant ID supplied by the
model as proof of authorization.

## Public plugin submission

A public submission needs a stable production HTTPS MCP endpoint. Temporary
tunnels and localhost are not acceptable. The operator must also be able to
serve the exact domain verification token from:

```text
https://<verified-host>/.well-known/openai-apps-challenge
```

Set `OPENAI_APPS_CHALLENGE` only through the deployment's secret-management
system. The endpoint returns plain text and must contain only the active token.
The current repository still requires production authentication, tenant
isolation, a stable deployment, publisher verification, and review materials
before public submission. See [submission-readiness.md](submission-readiness.md).
