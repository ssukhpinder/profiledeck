import assert from "node:assert/strict";
import test from "node:test";

import { PERSONAL_PROFILE, WORK_PROFILE } from "../src/defaults.js";
import { evaluateRoute } from "../src/policy.js";
import { ProfileInputSchema } from "../src/types.js";

test("Personal allows an explicitly requested Calendar read", () => {
  const result = evaluateRoute(PERSONAL_PROFILE, {
    connectorId: "google-calendar",
    operation: "read",
    destination: "Personal calendar",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "allow");
  assert.equal(result.allowed, true);
  assert.equal(result.needsConfirmation, false);
  assert.equal(result.profile.id, "personal");
  assert.equal(result.route.connectorId, "google-calendar");
  assert.equal(result.route.connectorInstance, "Personal calendar");
  assert.match(result.reminder, /not authorization/i);
});

test("Personal asks before using an unknown Slack connector", () => {
  const result = evaluateRoute(PERSONAL_PROFILE, {
    connectorId: "slack",
    operation: "read",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "confirm");
  assert.equal(result.allowed, false);
  assert.equal(result.needsConfirmation, true);
  assert.match(result.reason, /not in Personal/i);
  assert.match(result.reason, /one-time override|switch profiles/i);
});

test("Work denies an unknown Calendar connector", () => {
  const result = evaluateRoute(WORK_PROFILE, {
    connectorId: "google-calendar",
    operation: "read",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.allowed, false);
  assert.equal(result.needsConfirmation, false);
  assert.match(result.reason, /not allowed by Work/i);
});

test("Work requires confirmation before an explicitly requested Slack send", () => {
  const result = evaluateRoute(WORK_PROFILE, {
    connectorId: "slack",
    operation: "send",
    destination: "#release",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "confirm");
  assert.equal(result.allowed, false);
  assert.equal(result.needsConfirmation, true);
  assert.equal(result.route.connectorInstance, "Work workspace");
  assert.equal(result.route.destination, "#release");
  assert.match(result.reason, /requires explicit confirmation/i);
});

test("Work denies GitHub writes that are outside the connector allowlist", () => {
  const result = evaluateRoute(WORK_PROFILE, {
    connectorId: "github",
    operation: "write",
    destination: "company/repository",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.allowed, false);
  assert.equal(result.needsConfirmation, false);
  assert.match(result.reason, /write is not allowed for github/i);
});

test("Work blocks delete operations at the profile level", () => {
  const result = evaluateRoute(WORK_PROFILE, {
    skillId: "work-assistant",
    operation: "delete",
    destination: "external record",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.allowed, false);
  assert.equal(result.needsConfirmation, false);
  assert.match(result.reason, /delete operations are blocked by Work/i);
});

test("Personal connector limits override an unknown-skill confirmation", () => {
  const result = evaluateRoute(PERSONAL_PROFILE, {
    skillId: "unlisted-personal-skill",
    connectorId: "google-calendar",
    operation: "send",
    destination: "Personal calendar",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.allowed, false);
  assert.equal(result.needsConfirmation, false);
  assert.match(result.reason, /send is not allowed for google-calendar/i);
});

test("Personal delete policy overrides an unknown-Slack confirmation", () => {
  const result = evaluateRoute(PERSONAL_PROFILE, {
    connectorId: "slack",
    operation: "delete",
    destination: "personal workspace message",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.allowed, false);
  assert.equal(result.needsConfirmation, false);
  assert.match(result.reason, /delete operations are blocked by Personal/i);
});

test("ProfileDeck still confirms deletes when a custom profile follows native policy", () => {
  const permissiveDeleteProfile = {
    ...PERSONAL_PROFILE,
    approvals: {
      ...PERSONAL_PROFILE.approvals,
      delete: "follow_native" as const
    }
  };

  const result = evaluateRoute(permissiveDeleteProfile, {
    skillId: "personal-assistant",
    operation: "delete",
    destination: "saved draft",
    explicitlyRequested: true
  });

  assert.equal(result.decision, "confirm");
  assert.equal(result.allowed, false);
  assert.equal(result.needsConfirmation, true);
  assert.match(result.reason, /always requires explicit confirmation before delete/i);
});

test("profile validation rejects duplicate capability identifiers and operations", () => {
  const duplicateSkill = structuredClone(PERSONAL_PROFILE);
  duplicateSkill.capabilities.skills.push({
    ...duplicateSkill.capabilities.skills[0]!
  });

  const duplicateConnector = structuredClone(PERSONAL_PROFILE);
  duplicateConnector.capabilities.connectors.push({
    ...duplicateConnector.capabilities.connectors[0]!,
    instanceLabel: "Second label"
  });

  const duplicateOperation = structuredClone(PERSONAL_PROFILE);
  duplicateOperation.capabilities.connectors[0]!.allowedOperations = ["read", "read"];

  const skillResult = ProfileInputSchema.safeParse(duplicateSkill);
  const connectorResult = ProfileInputSchema.safeParse(duplicateConnector);
  const operationResult = ProfileInputSchema.safeParse(duplicateOperation);

  assert.equal(skillResult.success, false);
  assert.equal(connectorResult.success, false);
  assert.equal(operationResult.success, false);

  if (!skillResult.success) {
    assert.match(skillResult.error.message, /Duplicate skill ID/i);
  }
  if (!connectorResult.success) {
    assert.match(connectorResult.error.message, /Duplicate connector ID/i);
  }
  if (!operationResult.success) {
    assert.match(operationResult.error.message, /Duplicate operation/i);
  }
});
