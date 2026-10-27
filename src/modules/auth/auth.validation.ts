import { z } from "zod";

export const googleSignInSchema = z.object({
  idToken: z.string().trim().min(1, "idToken is required"),
});

export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;

export const firebaseSignInSchema = z.object({
  idToken: z.string().trim().min(1, "idToken is required"),
});

export type FirebaseSignInInput = z.infer<typeof firebaseSignInSchema>;

const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(100);
const emailSchema = z.string().trim().email().max(255);
const phoneSchema = z.string().trim().regex(/^\+?[0-9]{8,15}$/).max(20);

export const registerSchema = z
  .object({
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    password: passwordSchema,
  })
  .refine((data) => Boolean(data.email || data.phone), {
    message: "Email or phone is required",
    path: ["email"],
  });

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Email or phone is required")
    .max(255)
    .refine(
      (value) => (value.includes("@") ? emailSchema.safeParse(value).success : phoneSchema.safeParse(value).success),
      "Enter a valid email or phone number"
    ),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
