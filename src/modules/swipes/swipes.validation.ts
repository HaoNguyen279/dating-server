import { z } from "zod";

export const createSwipeSchema = z.object({
    swiper_id: z.string().uuid(),
    swiped_id: z.string().uuid(),
    action: z.enum(["like", "pass", "super_like"])
});