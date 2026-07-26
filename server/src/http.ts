import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";

import { createProfileDeckServer } from "./mcp.js";
import { FileProfileStore } from "./store.js";

const VERSION = "0.1.0";
const host = process.env.PROFILEDECK_HOST?.trim() || "127.0.0.1";
const port = Number.parseInt(process.env.PROFILEDECK_PORT?.trim() || "3000", 10);
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const allowedHosts = (process.env.PROFILEDECK_ALLOWED_HOSTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PROFILEDECK_PORT must be an integer between 1 and 65535.");
}

if (!loopbackHosts.has(host) && process.env.PROFILEDECK_ALLOW_INSECURE_HTTP !== "1") {
  throw new Error(
    "Refusing a non-loopback HTTP bind without PROFILEDECK_ALLOW_INSECURE_HTTP=1. This demo transport does not provide production authentication."
  );
}

const app = createMcpExpressApp({
  host,
  ...(allowedHosts.length > 0 ? { allowedHosts } : {})
});
const store = new FileProfileStore();

app.get("/healthz", (_request: Request, response: Response) => {
  response.json({ status: "ok", version: VERSION });
});

app.get(
  "/.well-known/openai-apps-challenge",
  (_request: Request, response: Response) => {
    const challenge = process.env.OPENAI_APPS_CHALLENGE?.trim();
    if (!challenge) {
      response.status(404).send("Challenge token is not configured.");
      return;
    }
    response.type("text/plain").send(challenge);
  }
);

app.post("/mcp", async (request: Request, response: Response) => {
  const server = createProfileDeckServer(store);
  const transport = new StreamableHTTPServerTransport();

  try {
    await server.connect(transport as Parameters<typeof server.connect>[0]);
    await transport.handleRequest(request, response, request.body);
    response.on("close", () => {
      void transport.close();
      void server.close();
    });
  } catch (error) {
    console.error("ProfileDeck MCP request failed:", error);
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
});

function methodNotAllowed(_request: Request, response: Response): void {
  response.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null
  });
}

app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

const httpServer = app.listen(port, host, () => {
  console.log(`ProfileDeck MCP HTTP server listening at http://${host}:${port}/mcp`);
});

httpServer.on("error", (error) => {
  console.error("ProfileDeck HTTP server failed:", error);
  process.exitCode = 1;
});

function shutdown(): void {
  httpServer.close((error) => {
    if (error) {
      console.error("ProfileDeck HTTP shutdown failed:", error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
