import { z } from "zod";

export const recommendationQuerySchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)").optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(64).optional(),
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
