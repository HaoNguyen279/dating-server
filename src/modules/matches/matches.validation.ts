import { z } from "zod";

export const matchIdParamSchema = z.object({
  id: z.string().uuid("Invalid match ID format (UUID required)"),
});

export const matchUserIdParamSchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)"),
});

export const listMatchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "unmatched"]).default("active"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
