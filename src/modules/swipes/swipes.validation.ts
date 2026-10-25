import { z } from "zod";

export const createSwipeSchema = z
  .object({
    swiper_id: z.string().uuid("Invalid swiper_id format (UUID required)"),
    swiped_id: z.string().uuid("Invalid swiped_id format (UUID required)"),
    action: z.enum(["like", "pass", "super_like"]),
  })
  .refine((data) => data.swiper_id !== data.swiped_id, {
    message: "Cannot swipe on yourself",
    path: ["swiped_id"],
  });

export const swipeUserIdParamSchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)"),
});

export const listSwipesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.enum(["like", "pass", "super_like"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateSwipeInput = z.infer<typeof createSwipeSchema>;
export type ListSwipesQuery = z.infer<typeof listSwipesQuerySchema>;
