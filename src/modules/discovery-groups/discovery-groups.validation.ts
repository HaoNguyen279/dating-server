import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens");

export const discoveryGroupSlugParamSchema = z.object({ slug: slugSchema });

