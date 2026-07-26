import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createProfileDeckServer, PROFILEDECK_TOOL_METADATA } from "../src/mcp.js";
import { FileProfileStore } from "../src/store.js";

const EXPECTED_TOOLS = [
  "list_profiles",
  "get_profile",
  "save_profile",
  "delete_profile",
  "open_profile",
  "get_profile_context",
  "close_profile_context",
  "evaluate_route"
] as const;

test("exports complete and uniquely named MCP tool metadata", () => {
  assert.ok(Array.isArray(PROFILEDECK_TOOL_METADATA));
  assert.equal(PROFILEDECK_TOOL_METADATA.length, EXPECTED_TOOLS.length);

  const names = PROFILEDECK_TOOL_METADATA.map((tool) => tool.name);
  assert.deepEqual([...names].sort(), [...EXPECTED_TOOLS].sort());
  assert.equal(new Set(names).size, names.length);

  for (const tool of PROFILEDECK_TOOL_METADATA) {
    assert.equal(typeof tool.title, "string");
    assert.ok(tool.title.trim().length > 0);
    assert.equal(typeof tool.description, "string");
    assert.ok(tool.description.trim().length >= 20);
    assert.equal(typeof tool.inputSchema, "object");
    assert.ok(tool.inputSchema !== null);
    assert.equal(typeof tool.outputSchema, "object");
    assert.ok(tool.outputSchema !== null);
    assert.equal(typeof tool.annotations.readOnlyHint, "boolean");
    assert.equal(typeof tool.annotations.destructiveHint, "boolean");
    assert.equal(typeof tool.annotations.idempotentHint, "boolean");
    assert.equal(typeof tool.annotations.openWorldHint, "boolean");
    assert.equal(tool.annotations.openWorldHint, false);
  }
});

test("metadata marks reads and mutations with honest safety annotations", () => {
  const tools = new Map(
    PROFILEDECK_TOOL_METADATA.map((metadata) => [metadata.name, metadata])
  );

  for (const name of [
    "list_profiles",
    "get_profile",
    "get_profile_context",
    "evaluate_route"
  ] as const) {
    assert.equal(tools.get(name)?.annotations.readOnlyHint, true, `${name} should be read-only`);
    assert.equal(
      tools.get(name)?.annotations.destructiveHint,
      false,
      `${name} should not be destructive`
    );
    assert.equal(
      tools.get(name)?.annotations.idempotentHint,
      true,
      `${name} should be idempotent`
    );
  }

  assert.equal(tools.get("save_profile")?.annotations.readOnlyHint, false);
  assert.equal(tools.get("save_profile")?.annotations.destructiveHint, true);
  assert.equal(tools.get("save_profile")?.annotations.idempotentHint, false);

  assert.equal(tools.get("delete_profile")?.annotations.readOnlyHint, false);
  assert.equal(tools.get("delete_profile")?.annotations.destructiveHint, true);
  assert.equal(tools.get("delete_profile")?.annotations.idempotentHint, true);

  assert.equal(tools.get("open_profile")?.annotations.readOnlyHint, false);
  assert.equal(tools.get("open_profile")?.annotations.destructiveHint, false);
  assert.equal(tools.get("open_profile")?.annotations.idempotentHint, false);

  assert.equal(tools.get("close_profile_context")?.annotations.readOnlyHint, false);
  assert.equal(tools.get("close_profile_context")?.annotations.destructiveHint, true);
  assert.equal(tools.get("close_profile_context")?.annotations.idempotentHint, true);
});

test("tool input schemas expose routing and revision-safety inputs", () => {
  const tools = new Map(
    PROFILEDECK_TOOL_METADATA.map((metadata) => [metadata.name, metadata])
  );

  const saveSchema = tools.get("save_profile")?.inputSchema;
  assert.ok(saveSchema);
  assert.ok("profile" in saveSchema);

  const openSchema = tools.get("open_profile")?.inputSchema;
  assert.ok(openSchema);
  assert.ok("profileId" in openSchema);
  assert.ok("ttlMinutes" in openSchema);

  const routeSchema = tools.get("evaluate_route")?.inputSchema;
  assert.ok(routeSchema);
  assert.ok("contextId" in routeSchema);
  assert.ok("connectorId" in routeSchema);
  assert.ok("operation" in routeSchema);
  assert.ok("explicitlyRequested" in routeSchema);
});

test("advertises output schemas and validates structured results over MCP", async () => {
  const directory = await mkdtemp(join(tmpdir(), "profiledeck-mcp-test-"));
  const store = new FileProfileStore(join(directory, "profiles.json"));
  const server = createProfileDeckServer(store);
  const client = new Client({ name: "profiledeck-contract-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport as Parameters<typeof server.connect>[0]);
  await client.connect(clientTransport as Parameters<typeof client.connect>[0]);

  try {
    const listedTools = await client.listTools();
    assert.deepEqual(
      listedTools.tools.map((tool) => tool.name).sort(),
      [...EXPECTED_TOOLS].sort()
    );

    for (const tool of listedTools.tools) {
      assert.equal(tool.inputSchema.type, "object", `${tool.name} needs an input schema`);
      assert.equal(tool.outputSchema?.type, "object", `${tool.name} needs an output schema`);
      assert.equal(typeof tool.annotations?.readOnlyHint, "boolean");
      assert.equal(typeof tool.annotations?.destructiveHint, "boolean");
      assert.equal(typeof tool.annotations?.openWorldHint, "boolean");
    }

    const listed = await client.callTool({ name: "list_profiles", arguments: {} });
    assert.notEqual(listed.isError, true);
    const listedContent = listed.structuredContent as { profiles?: unknown[] } | undefined;
    assert.equal(listedContent?.profiles?.length, 2);

    const opened = await client.callTool({
      name: "open_profile",
      arguments: { profileId: "work", ttlMinutes: 5 }
    });
    assert.notEqual(opened.isError, true);
    const openedContent = opened.structuredContent as
      | { context?: { id?: unknown } }
      | undefined;
    const contextId = openedContent?.context?.id;
    assert.equal(typeof contextId, "string");
    if (typeof contextId !== "string") {
      throw new Error("open_profile did not return a context ID.");
    }

    const evaluated = await client.callTool({
      name: "evaluate_route",
      arguments: {
        contextId,
        connectorId: "slack",
        operation: "send",
        destination: "#release",
        explicitlyRequested: true
      }
    });
    assert.notEqual(evaluated.isError, true);
    const evaluatedContent = evaluated.structuredContent as
      | { decision?: { decision?: unknown; allowed?: unknown } }
      | undefined;
    assert.equal(evaluatedContent?.decision?.decision, "confirm");
    assert.equal(evaluatedContent?.decision?.allowed, false);
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
    await rm(directory, { recursive: true, force: true });
  }
});
