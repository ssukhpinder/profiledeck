import { z } from "zod";

export const OperationSchema = z.enum(["read", "draft", "write", "send", "delete"]);
export type Operation = z.infer<typeof OperationSchema>;

export const ApprovalRuleSchema = z.enum(["follow_native", "always_ask", "block"]);
export type ApprovalRule = z.infer<typeof ApprovalRuleSchema>;

export const SkillPolicySchema = z.object({
  id: z.string().min(1).max(128),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(50)
}).strict();

export const ConnectorPolicySchema = z.object({
  connectorId: z.string().min(1).max(128),
  instanceLabel: z.string().min(1).max(160).optional(),
  allowedOperations: z.array(OperationSchema).min(1).superRefine((operations, context) => {
    const seen = new Set<string>();
    operations.forEach((operation, index) => {
      if (seen.has(operation)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: `Duplicate operation: ${operation}`
        });
      }
      seen.add(operation);
    });
  }),
  activation: z.enum(["when_relevant", "explicit_only"]).default("explicit_only")
}).strict();

const SkillPoliciesSchema = z.array(SkillPolicySchema).max(100).superRefine((skills, context) => {
  const seen = new Set<string>();
  skills.forEach((skill, index) => {
    if (seen.has(skill.id)) {
      context.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `Duplicate skill ID: ${skill.id}`
      });
    }
    seen.add(skill.id);
  });
});

const ConnectorPoliciesSchema = z
  .array(ConnectorPolicySchema)
  .max(100)
  .superRefine((connectors, context) => {
    const seen = new Set<string>();
    connectors.forEach((connector, index) => {
      if (seen.has(connector.connectorId)) {
        context.addIssue({
          code: "custom",
          path: [index, "connectorId"],
          message: `Duplicate connector ID: ${connector.connectorId}`
        });
      }
      seen.add(connector.connectorId);
    });
  });

export const ProfileSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  revision: z.number().int().positive(),
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  instructions: z.object({
    context: z.string().max(1500).default(""),
    dataHandling: z.array(z.string().min(1).max(300)).max(20).default([])
  }).strict(),
  capabilities: z.object({
    skills: SkillPoliciesSchema.default([]),
    connectors: ConnectorPoliciesSchema.default([]),
    unknownCapability: z.enum(["block", "ask"]).default("block")
  }).strict(),
  approvals: z.object({
    read: ApprovalRuleSchema,
    draft: ApprovalRuleSchema,
    write: ApprovalRuleSchema,
    send: ApprovalRuleSchema,
    delete: ApprovalRuleSchema
  }).strict()
}).strict();
export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileInputSchema = ProfileSchema.omit({ revision: true }).extend({
  revision: z.number().int().positive().optional()
}).strict();
export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export const ProfileContextSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string(),
  profileRevision: z.number().int().positive(),
  profileSnapshot: ProfileSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime()
}).strict();
export type ProfileContext = z.infer<typeof ProfileContextSchema>;

export const StoredStateSchema = z.object({
  schemaVersion: z.literal(1),
  profiles: z.array(ProfileSchema),
  contexts: z.array(ProfileContextSchema)
}).strict();
export type StoredState = z.infer<typeof StoredStateSchema>;

export const RouteRequestSchema = z.object({
  skillId: z.string().min(1).max(128).optional(),
  connectorId: z.string().min(1).max(128).optional(),
  operation: OperationSchema,
  destination: z.string().min(1).max(200).optional(),
  explicitlyRequested: z.boolean().default(false)
}).strict();
export type RouteRequest = z.infer<typeof RouteRequestSchema>;

export const RouteDecisionSchema = z.object({
  decision: z.enum(["allow", "confirm", "deny"]),
  allowed: z.boolean(),
  needsConfirmation: z.boolean(),
  reason: z.string(),
  profile: z.object({
    id: z.string(),
    name: z.string(),
    revision: z.number().int().positive()
  }).strict(),
  route: z.object({
    skillId: z.string().optional(),
    connectorId: z.string().optional(),
    connectorInstance: z.string().optional(),
    operation: OperationSchema,
    destination: z.string().optional()
  }).strict(),
  reminder: z.string()
}).strict();
export type RouteDecision = z.infer<typeof RouteDecisionSchema>;
