import type { Profile, StoredState } from "./types.js";

export const PERSONAL_PROFILE: Profile = {
  id: "personal",
  revision: 1,
  name: "Personal",
  description: "Personal planning, writing, learning, travel, and household tasks.",
  instructions: {
    context: "Use a friendly, practical tone and prioritize clear next actions.",
    dataHandling: [
      "Do not move company or client information into Personal connectors.",
      "Confirm the account and destination before external actions."
    ]
  },
  capabilities: {
    skills: [{ id: "personal-assistant", enabled: true, priority: 100 }],
    connectors: [
      {
        connectorId: "google-calendar",
        instanceLabel: "Personal calendar",
        allowedOperations: ["read", "draft"],
        activation: "explicit_only"
      }
    ],
    unknownCapability: "ask"
  },
  approvals: {
    read: "follow_native",
    draft: "follow_native",
    write: "always_ask",
    send: "always_ask",
    delete: "block"
  }
};

export const WORK_PROFILE: Profile = {
  id: "work",
  revision: 1,
  name: "Work",
  description: "Projects, code review, meetings, and company-system tasks.",
  instructions: {
    context: "Use concise professional communication with owners, risks, and next actions.",
    dataHandling: [
      "Do not route company or client data into Personal connectors.",
      "Confirm the organization and destination before external writes."
    ]
  },
  capabilities: {
    skills: [{ id: "work-assistant", enabled: true, priority: 100 }],
    connectors: [
      {
        connectorId: "github",
        instanceLabel: "Work organization",
        allowedOperations: ["read", "draft"],
        activation: "when_relevant"
      },
      {
        connectorId: "slack",
        instanceLabel: "Work workspace",
        allowedOperations: ["read", "draft", "send"],
        activation: "explicit_only"
      }
    ],
    unknownCapability: "block"
  },
  approvals: {
    read: "follow_native",
    draft: "follow_native",
    write: "always_ask",
    send: "always_ask",
    delete: "block"
  }
};

export function createDefaultState(): StoredState {
  return {
    schemaVersion: 1,
    profiles: [structuredClone(PERSONAL_PROFILE), structuredClone(WORK_PROFILE)],
    contexts: []
  };
}
