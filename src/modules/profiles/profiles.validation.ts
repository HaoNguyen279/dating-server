import { z } from "zod";

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

const birthDateSchema = z
  .union([z.string(), z.date()])
  .transform((val) => new Date(val))
  .superRefine((date, ctx) => {
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Invalid date format for birth_date",
      });
      return;
    }
    const age = calculateAge(date);
    if (age < 18) {
      ctx.addIssue({
        code: "custom",
        message: "User must be at least 18 years old",
      });
      return;
    }
    if (age > 120) {
      ctx.addIssue({
        code: "custom",
        message: "Birth date exceeds valid range (maximum age 120)",
      });
    }
  });

function validateGeoPair<T extends { latitude?: number | null; longitude?: number | null }>(
  data: T,
  ctx: z.RefinementCtx
) {
  const hasLat = data.latitude !== undefined && data.latitude !== null;
  const hasLng = data.longitude !== undefined && data.longitude !== null;
  if (hasLat !== hasLng) {
    ctx.addIssue({
      code: "custom",
      path: ["latitude"],
      message: "Both latitude and longitude must be provided together or both omitted",
    });
  }
}

export const createProfileSchema = z
  .object({
    user_id: z.string().uuid("Invalid user ID format (UUID required)"),
    display_name: z
      .string()
      .trim()
      .min(1, "Display name cannot be empty")
      .max(50, "Display name cannot exceed 50 characters"),
    birth_date: birthDateSchema,
    gender: z.enum(["male", "female", "non_binary", "other"]),
    bio: z.string().trim().max(500, "Bio cannot exceed 500 characters").optional().nullable(),
    job_title: z.string().trim().max(100, "Job title cannot exceed 100 characters").optional().nullable(),
    height_cm: z.coerce.number().int().min(100, "Height must be at least 100cm").max(250, "Height cannot exceed 250cm").optional().nullable(),
    city: z.string().trim().max(100, "City name cannot exceed 100 characters").optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    is_verified: z.boolean().optional().default(false),
    education: z.string().trim().max(100).optional().nullable(),
    pets: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    life_style: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    languages: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .superRefine(validateGeoPair);

export const updateProfileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, "Display name cannot be empty")
      .max(50, "Display name cannot exceed 50 characters")
      .optional(),
    birth_date: birthDateSchema.optional(),
    gender: z.enum(["male", "female", "non_binary", "other"]).optional(),
    bio: z.string().trim().max(500, "Bio cannot exceed 500 characters").optional().nullable(),
    job_title: z.string().trim().max(100, "Job title cannot exceed 100 characters").optional().nullable(),
    height_cm: z.coerce.number().int().min(100, "Height must be at least 100cm").max(250, "Height cannot exceed 250cm").optional().nullable(),
    city: z.string().trim().max(100, "City name cannot exceed 100 characters").optional().nullable(),
    latitude: z.coerce.number().min(-90).max(90).optional().nullable(),
    longitude: z.coerce.number().min(-180).max(180).optional().nullable(),
    is_verified: z.boolean().optional(),
    education: z.string().trim().max(100).optional().nullable(),
    pets: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    life_style: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    languages: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  })
  .superRefine(validateGeoPair);

export const profileIdParamSchema = z.object({
  id: z.string().uuid("Invalid profile ID format (UUID required)"),
});

export const profileUserIdParamSchema = z.object({
  userId: z.string().uuid("Invalid user ID format (UUID required)"),
});

export const listProfilesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  gender: z.enum(["male", "female", "non_binary", "other"]).optional(),
  city: z.string().trim().optional(),
  search: z.string().trim().optional(),
  is_verified: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  minAge: z.coerce.number().int().min(18).max(120).optional(),
  maxAge: z.coerce.number().int().min(18).max(120).optional(),
  sortBy: z.enum(["display_name", "birth_date"]).default("birth_date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeUser: z
    .preprocess((val) => val === "true" || val === true || val === "1", z.boolean())
    .default(false),
  includePhotos: z
    .preprocess((val) => val === "true" || val === true || val === "1", z.boolean())
    .default(false),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListProfilesQuery = z.infer<typeof listProfilesQuerySchema>;
