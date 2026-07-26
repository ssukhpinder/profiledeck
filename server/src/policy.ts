import {
  RouteDecisionSchema,
  type Profile,
  type RouteDecision,
  type RouteRequest
} from "./types.js";

const NATIVE_REMINDER =
  "This is a ProfileDeck routing decision, not authorization. Native authentication, workspace policy, and confirmation prompts still apply.";

type Finding = {
  level: "confirm" | "deny";
  reason: string;
};

function routeShape(request: RouteRequest) {
  return {
    operation: request.operation,
    ...(request.skillId ? { skillId: request.skillId } : {}),
    ...(request.connectorId ? { connectorId: request.connectorId } : {}),
    ...(request.destination ? { destination: request.destination } : {})
  };
}

function decision(
  profile: Profile,
  request: RouteRequest,
  value: "allow" | "confirm" | "deny",
  reason: string,
  connectorInstance?: string
): RouteDecision {
  return RouteDecisionSchema.parse({
    decision: value,
    allowed: value === "allow",
    needsConfirmation: value === "confirm",
    reason,
    profile: { id: profile.id, name: profile.name, revision: profile.revision },
    route: {
      ...routeShape(request),
      ...(connectorInstance ? { connectorInstance } : {})
    },
    reminder: NATIVE_REMINDER
  });
}

function combinedDecision(
  profile: Profile,
  request: RouteRequest,
  findings: Finding[],
  connectorInstance?: string
): RouteDecision {
  const denials = findings.filter((finding) => finding.level === "deny");
  if (denials.length > 0) {
    return decision(
      profile,
      request,
      "deny",
      denials.map((finding) => finding.reason).join(" "),
      connectorInstance
    );
  }

  const confirmations = findings.filter((finding) => finding.level === "confirm");
  if (confirmations.length > 0) {
    return decision(
      profile,
      request,
      "confirm",
      confirmations.map((finding) => finding.reason).join(" "),
      connectorInstance
    );
  }

  return decision(
    profile,
    request,
    "allow",
    `The proposed route fits ${profile.name}.`,
    connectorInstance
  );
}

export function evaluateRoute(profile: Profile, request: RouteRequest): RouteDecision {
  if (!request.skillId && !request.connectorId) {
    return decision(
      profile,
      request,
      "deny",
      "A skill or connector is required before ProfileDeck can evaluate a route."
    );
  }

  const findings: Finding[] = [];

  if (request.skillId) {
    const skill = profile.capabilities.skills.find(
      (candidate) => candidate.id === request.skillId && candidate.enabled
    );
    if (!skill) {
      findings.push(
        profile.capabilities.unknownCapability === "ask"
          ? {
              level: "confirm",
              reason: `Skill ${request.skillId} is not in ${profile.name}. Confirm a one-time override or switch profiles.`
            }
          : {
              level: "deny",
              reason: `Skill ${request.skillId} is not allowed by ${profile.name}.`
            }
      );
    }
  }

  let connectorInstance: string | undefined;
  if (request.connectorId) {
    const connector = profile.capabilities.connectors.find(
      (candidate) => candidate.connectorId === request.connectorId
    );
    if (!connector) {
      findings.push(
        profile.capabilities.unknownCapability === "ask"
          ? {
              level: "confirm",
              reason: `Connector ${request.connectorId} is not in ${profile.name}. Confirm a one-time override or switch profiles.`
            }
          : {
              level: "deny",
              reason: `Connector ${request.connectorId} is not allowed by ${profile.name}.`
            }
      );
    } else {
      connectorInstance = connector.instanceLabel;
      if (!connector.allowedOperations.includes(request.operation)) {
        findings.push({
          level: "deny",
          reason: `${request.operation} is not allowed for ${request.connectorId} in ${profile.name}.`
        });
      }
      if (connector.activation === "explicit_only" && !request.explicitlyRequested) {
        findings.push({
          level: "confirm",
          reason: `${request.connectorId} is explicit-only in ${profile.name}. Confirm this connector and destination before use.`
        });
      }
    }
  }

  const approvalRule = profile.approvals[request.operation];
  if (approvalRule === "block") {
    findings.push({
      level: "deny",
      reason: `${request.operation} operations are blocked by ${profile.name}.`
    });
  } else if (approvalRule === "always_ask") {
    findings.push({
      level: "confirm",
      reason: `${profile.name} requires explicit confirmation before ${request.operation}.`
    });
  }

  if (request.operation === "delete" && approvalRule === "follow_native") {
    findings.push({
      level: "confirm",
      reason: "ProfileDeck always requires explicit confirmation before delete."
    });
  }

  return combinedDecision(profile, request, findings, connectorInstance);
}
