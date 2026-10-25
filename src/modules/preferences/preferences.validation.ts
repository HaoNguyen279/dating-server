import { z } from "zod";

const preferenceFields = {
  interested_in: z.enum(["male", "female", "everyone"]).optional(),
  age_min: z.coerce.number().int().min(18).max(120).optional(),
  age_max: z.coerce.number().int().min(18).max(120).optional(),
  max_distance_km: z.coerce.number().int().min(1).max(20_000).optional(),
  show_me: z.boolean().optional(),
};

function validateAgeRange<T extends { age_min?: number; age_max?: number }>(value: T, ctx: z.RefinementCtx) {
  if (value.age_min !== undefined && value.age_max !== undefined && value.age_max < value.age_min) {
    ctx.addIssue({
      code: "custom",
      path: ["age_max"],
      message: "age_max must be greater than or equal to age_min",
    });
  }
}

export const createPreferenceSchema = z
  .object({
    user_id: z.string().uuid("Invalid user ID format (UUID required)"),
    ...preferenceFields,
  })
  .superRefine(validateAgeRange);

export const updatePreferenceSchema = z
  .object(preferenceFields)
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided for update",
  })
  .superRefine(validateAgeRange);

export const preferenceUserIdParamSchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)"),
});

export const listPreferencesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  interested_in: z.enum(["male", "female", "everyone"]).optional(),
  show_me: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreatePreferenceInput = z.infer<typeof createPreferenceSchema>;
export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
export type ListPreferencesQuery = z.infer<typeof listPreferencesQuerySchema>;
