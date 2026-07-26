import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createProfileDeckServer } from "./mcp.js";
import { FileProfileStore } from "./store.js";

const store = new FileProfileStore();
const server = createProfileDeckServer(store);
const transport = new StdioServerTransport();

async function shutdown(): Promise<void> {
  await server.close();
}

process.once("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
process.once("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

try {
  await server.connect(transport);
} catch (error) {
  console.error("ProfileDeck MCP server failed:", error);
  process.exitCode = 1;
}
