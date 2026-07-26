import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { evaluateRoute } from "./policy.js";
import type { ProfileStore } from "./store.js";
import {
  OperationSchema,
  ProfileContextSchema,
  ProfileInputSchema,
  ProfileSchema,
  RouteDecisionSchema,
  RouteRequestSchema
} from "./types.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
} as const;

const WRITE_SAFE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
} as const;

const LIST_PROFILES = {
  name: "list_profiles",
  title: "List profiles",
  description: "Lists available ProfileDeck profiles without selecting one.",
  inputSchema: {},
  outputSchema: {
    profiles: z.array(ProfileSchema)
  },
  annotations: READ_ONLY
} as const;

const GET_PROFILE = {
  name: "get_profile",
  title: "Get profile",
  description: "Returns one profile definition, including its routing and approval policy.",
  inputSchema: {
    profileId: z.string().min(1).max(64).describe("Profile ID, such as personal or work")
  },
  outputSchema: {
    profile: ProfileSchema
  },
  annotations: READ_ONLY
} as const;

const SAVE_PROFILE = {
  name: "save_profile",
  title: "Save profile",
  description: "Creates or updates a ProfileDeck profile. Existing profiles use revision checks.",
  inputSchema: {
    profile: ProfileInputSchema.describe("Complete profile definition to create or update")
  },
  outputSchema: {
    profile: ProfileSchema
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false
  } as const
} as const;

const DELETE_PROFILE = {
  name: "delete_profile",
  title: "Delete profile",
  description: "Deletes a profile and closes its contexts. At least one profile must remain.",
  inputSchema: {
    profileId: z.string().min(1).max(64).describe("Profile ID to delete")
  },
  outputSchema: {
    profileId: z.string(),
    deleted: z.boolean()
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false
  } as const
} as const;

const OPEN_PROFILE = {
  name: "open_profile",
  title: "Open profile context",
  description: "Pins an explicitly selected profile snapshot to a new conversation context.",
  inputSchema: {
    profileId: z.string().min(1).max(64).describe("Profile explicitly selected by the user"),
    ttlMinutes: z
      .number()
      .int()
      .min(5)
      .max(1440)
      .default(480)
      .describe("Context lifetime in minutes")
  },
  outputSchema: {
    context: ProfileContextSchema
  },
  annotations: WRITE_SAFE
} as const;

const GET_PROFILE_CONTEXT = {
  name: "get_profile_context",
  title: "Get profile context",
  description: "Returns a current profile context and the pinned profile snapshot it uses.",
  inputSchema: {
    contextId: z.string().uuid().describe("Opaque context ID returned by open_profile")
  },
  outputSchema: {
    context: ProfileContextSchema
  },
  annotations: READ_ONLY
} as const;

const CLOSE_PROFILE_CONTEXT = {
  name: "close_profile_context",
  title: "Close profile context",
  description: "Closes one profile context without changing or deleting the profile.",
  inputSchema: {
    contextId: z.string().uuid().describe("Opaque context ID to close")
  },
  outputSchema: {
    contextId: z.string().uuid(),
    closed: z.boolean()
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false
  } as const
} as const;

const EVALUATE_ROUTE = {
  name: "evaluate_route",
  title: "Evaluate profile route",
  description: "Checks a proposed skill or connector operation against a pinned profile policy.",
  inputSchema: {
    contextId: z.string().uuid().describe("Opaque context ID returned by open_profile"),
    skillId: z.string().min(1).max(128).optional().describe("Skill proposed for the task"),
    connectorId: z
      .string()
      .min(1)
      .max(128)
      .optional()
      .describe("Connector proposed for the task"),
    operation: OperationSchema.describe("Operation class to evaluate"),
    destination: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe("Human-readable destination, when known"),
    explicitlyRequested: z
      .boolean()
      .default(false)
      .describe("Whether the user explicitly named this connector for this action")
  },
  outputSchema: {
    decision: RouteDecisionSchema
  },
  annotations: READ_ONLY
} as const;

export const PROFILEDECK_TOOL_METADATA = [
  LIST_PROFILES,
  GET_PROFILE,
  SAVE_PROFILE,
  DELETE_PROFILE,
  OPEN_PROFILE,
  GET_PROFILE_CONTEXT,
  CLOSE_PROFILE_CONTEXT,
  EVALUATE_ROUTE
] as const;

const SERVER_INSTRUCTIONS =
  "ProfileDeck routes only its own workflows. Ask the user to explicitly choose a profile; never infer Personal or Work. Open a context and pass its ID to evaluate_route before skill or connector use. A routing decision never bypasses native authorization, workspace policy, or host confirmations. ProfileDeck cannot connect or disconnect unrelated apps or change ChatGPT memory or global settings. If a context is missing or expired, ask the user to select a profile again.";

function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : "Unexpected ProfileDeck error.";
  return {
    isError: true,
    content: [{ type: "text", text: message }]
  };
}

async function result<T extends Record<string, unknown>>(
  action: () => Promise<T>,
  text: (payload: T) => string
): Promise<CallToolResult> {
  try {
    const payload = await action();
    return {
      structuredContent: payload,
      content: [{ type: "text", text: text(payload) }]
    };
  } catch (error) {
    return errorResult(error);
  }
}

export function createProfileDeckServer(store: ProfileStore): McpServer {
  const server = new McpServer(
    {
      name: "profiledeck",
      version: "0.1.0",
      websiteUrl: "https://github.com/ssukhpinder/profiledeck"
    },
    {
      instructions: SERVER_INSTRUCTIONS
    }
  );

  server.registerTool(
    LIST_PROFILES.name,
    LIST_PROFILES,
    async () =>
      result(
        async () => ({ profiles: await store.listProfiles() }),
        ({ profiles }) => `Found ${profiles.length} ProfileDeck profile(s).`
      )
  );

  server.registerTool(
    GET_PROFILE.name,
    GET_PROFILE,
    async ({ profileId }) =>
      result(
        async () => {
          const profile = await store.getProfile(profileId);
          if (!profile) {
            throw new Error(`PROFILE_NOT_FOUND: ${profileId}`);
          }
          return { profile };
        },
        ({ profile }) => `Loaded profile ${profile.name} at revision ${profile.revision}.`
      )
  );

  server.registerTool(
    SAVE_PROFILE.name,
    SAVE_PROFILE,
    async ({ profile }) =>
      result(
        async () => ({ profile: await store.saveProfile(profile) }),
        ({ profile: saved }) => `Saved profile ${saved.name} at revision ${saved.revision}.`
      )
  );

  server.registerTool(
    DELETE_PROFILE.name,
    DELETE_PROFILE,
    async ({ profileId }) =>
      result(
        async () => ({ profileId, deleted: await store.deleteProfile(profileId) }),
        ({ deleted }) => (deleted ? `Deleted profile ${profileId}.` : `Profile ${profileId} was not found.`)
      )
  );

  server.registerTool(
    OPEN_PROFILE.name,
    OPEN_PROFILE,
    async ({ profileId, ttlMinutes }) =>
      result(
        async () => ({ context: await store.openContext(profileId, ttlMinutes) }),
        ({ context }) =>
          `Opened ${context.profileSnapshot.name} for this conversation at revision ${context.profileRevision}.`
      )
  );

  server.registerTool(
    GET_PROFILE_CONTEXT.name,
    GET_PROFILE_CONTEXT,
    async ({ contextId }) =>
      result(
        async () => {
          const context = await store.getContext(contextId);
          if (!context) {
            throw new Error("PROFILE_REQUIRED: the profile context is missing or expired.");
          }
          return { context };
        },
        ({ context }) =>
          `This conversation uses ${context.profileSnapshot.name} revision ${context.profileRevision}.`
      )
  );

  server.registerTool(
    CLOSE_PROFILE_CONTEXT.name,
    CLOSE_PROFILE_CONTEXT,
    async ({ contextId }) =>
      result(
        async () => ({ contextId, closed: await store.closeContext(contextId) }),
        ({ closed }) => (closed ? "Closed the profile context." : "The profile context was already closed or expired.")
      )
  );

  server.registerTool(
    EVALUATE_ROUTE.name,
    EVALUATE_ROUTE,
    async ({ contextId, skillId, connectorId, operation, destination, explicitlyRequested }) =>
      result(
        async () => {
          const context = await store.getContext(contextId);
          if (!context) {
            throw new Error("PROFILE_REQUIRED: the profile context is missing or expired.");
          }
          const request = RouteRequestSchema.parse({
            skillId,
            connectorId,
            operation,
            destination,
            explicitlyRequested
          });
          return { decision: evaluateRoute(context.profileSnapshot, request) };
        },
        ({ decision }) => `${decision.profile.name}: ${decision.decision}. ${decision.reason}`
      )
  );

  return server;
}
