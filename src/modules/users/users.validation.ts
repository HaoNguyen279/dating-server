import { z } from "zod";

export const createUserSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Email format is invalid")
      .max(255, "Email must not exceed 255 characters")
      .optional()
      .nullable(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, "Phone number must be between 8 and 15 digits, optionally prefixed with +")
      .max(20, "Phone number must not exceed 20 characters")
      .optional()
      .nullable(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must not exceed 100 characters")
      .optional(),
    password_hash: z.string().optional(),
    status: z.enum(["active", "suspended", "deleted"]).default("active"),
  })
  .refine(
    (data) => Boolean(data.email && data.email.trim().length > 0) || Boolean(data.phone && data.phone.trim().length > 0),
    {
      message: "At least one contact method (email or phone) is required",
      path: ["email"],
    }
  );

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Email format is invalid")
      .max(255, "Email must not exceed 255 characters")
      .optional()
      .nullable(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, "Phone number must be between 8 and 15 digits, optionally prefixed with +")
      .max(20, "Phone number must not exceed 20 characters")
      .optional()
      .nullable(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password must not exceed 100 characters")
      .optional(),
    status: z.enum(["active", "suspended", "deleted"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateStatusSchema = z.object({
  status: z.enum(["active", "suspended", "deleted"]),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID format (UUID required)"),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(["created_at", "updated_at", "last_active_at"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  includeProfile: z
    .preprocess((val) => val === "true" || val === true || val === "1", z.boolean())
    .default(false),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const checkAvailabilityQuerySchema = z
  .object({
    email: z.string().trim().email("Invalid email format").optional(),
    phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/, "Invalid phone format").optional(),
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "Either email or phone query parameter must be provided",
  });

export type CheckAvailabilityQuery = z.infer<typeof checkAvailabilityQuerySchema>;

export const deleteUserQuerySchema = z.object({
  hard: z
    .preprocess((val) => val === "true" || val === true || val === "1", z.boolean())
    .default(false),
});

export type DeleteUserQuery = z.infer<typeof deleteUserQuerySchema>;
