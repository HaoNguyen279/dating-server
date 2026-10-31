import { z } from "zod";
import { RELATIONSHIP_INTENTIONS } from "../profiles/relationship-intention.js";

export const recommendationQuerySchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)").optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(64).optional(),
  groupSlug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  relationshipIntention: z.enum(RELATIONSHIP_INTENTIONS).optional(),
});

export const recommendationUserIdParamSchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)"),
});

export const recommendationImpressionSchema = z
  .object({
    sessionId: z.string().uuid("Invalid session ID format (UUID required)"),
    candidateUserIds: z
      .array(z.string().uuid("Invalid candidate user ID format (UUID required)"))
      .min(1)
      .max(50),
  })
  .strict();

export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
export type RecommendationImpressionInput = z.infer<typeof recommendationImpressionSchema>;
