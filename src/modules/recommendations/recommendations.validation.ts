import { z } from "zod";

export const recommendationQuerySchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)").optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().uuid("Invalid cursor format (UUID required)").optional(),
});

export const recommendationUserIdParamSchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)"),
});

export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
