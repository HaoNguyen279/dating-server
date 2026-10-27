import type { Request, Response } from "express";
import { AuthError, AuthService } from "./auth.service.js";
import { googleSignInSchema, firebaseSignInSchema, loginSchema, registerSchema } from "./auth.validation.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async register(req: Request, res: Response) {
    const result = registerSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: result.error.flatten().fieldErrors,
      });
    }

    try {
      const data = await this.authService.register(result.data);
      return res.status(201).json({ success: true, message: "Registered successfully", data });
    } catch (error) {
      return this.handleAuthError(res, error, "register");
    }
  }

  async login(req: Request, res: Response) {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: result.error.flatten().fieldErrors,
      });
    }

    try {
      const data = await this.authService.login(result.data);
      return res.status(200).json({ success: true, message: "Signed in successfully", data });
    } catch (error) {
      return this.handleAuthError(res, error, "login");
    }
  }

  private handleAuthError(res: Response, error: unknown, context: string) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error(`AuthController.${context} error:`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }

  async googleSignIn(req: Request, res: Response) {
    const result = googleSignInSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: result.error.flatten().fieldErrors,
      });
    }

    try {
      const data = await this.authService.signInWithGoogle(result.data.idToken);
      return res.status(data.isNewUser ? 201 : 200).json({
        success: true,
        message: data.isNewUser ? "Google account registered successfully" : "Signed in successfully",
        data,
      });
    } catch (error) {
      return this.handleAuthError(res, error, "googleSignIn");
    }
  }

  async firebaseSignIn(req: Request, res: Response) {
    const result = firebaseSignInSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: result.error.flatten().fieldErrors,
      });
    }

    try {
      const data = await this.authService.signInWithFirebase(result.data.idToken);
      return res.status(data.isNewUser ? 201 : 200).json({
        success: true,
        message: data.isNewUser ? "Firebase account registered successfully" : "Signed in successfully",
        data,
      });
    } catch (error) {
      return this.handleAuthError(res, error, "firebaseSignIn");
    }
  }
}
