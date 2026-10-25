import type { Request, Response } from "express";
import {
  createPreferenceSchema,
  listPreferencesQuerySchema,
  preferenceUserIdParamSchema,
  updatePreferenceSchema,
} from "./preferences.validation.js";
import { PreferencesHttpError, PreferencesService } from "./preferences.service.js";

export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  private handleError(res: Response, error: unknown, context: string) {
    if (error instanceof PreferencesHttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error(`PreferencesController.${context} error:`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }

  async list(req: Request, res: Response) {
    try {
      const parsed = listPreferencesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
          errors: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await this.preferencesService.list(parsed.data);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return this.handleError(res, error, "list");
    }
  }

  async getByUserId(req: Request, res: Response) {
    try {
      const params = preferenceUserIdParamSchema.safeParse(req.params);
      if (!params.success) return this.invalidParams(res, params.error.flatten().fieldErrors);
      const data = await this.preferencesService.getByUserId(params.data.userId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.handleError(res, error, "getByUserId");
    }
  }

  async create(req: Request, res: Response) {
    try {
      const body = createPreferenceSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid preference data",
          errors: body.error.flatten().fieldErrors,
        });
      }
      const data = await this.preferencesService.create(body.data);
      return res.status(201).json({ success: true, message: "Preferences created successfully", data });
    } catch (error) {
      return this.handleError(res, error, "create");
    }
  }

  async upsert(req: Request, res: Response) {
    try {
      const params = preferenceUserIdParamSchema.safeParse(req.params);
      if (!params.success) return this.invalidParams(res, params.error.flatten().fieldErrors);
      const body = updatePreferenceSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid preference data",
          errors: body.error.flatten().fieldErrors,
        });
      }
      const data = await this.preferencesService.upsert(params.data.userId, body.data);
      return res.status(200).json({ success: true, message: "Preferences saved successfully", data });
    } catch (error) {
      return this.handleError(res, error, "upsert");
    }
  }

  async update(req: Request, res: Response) {
    try {
      const params = preferenceUserIdParamSchema.safeParse(req.params);
      if (!params.success) return this.invalidParams(res, params.error.flatten().fieldErrors);
      const body = updatePreferenceSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid preference update data",
          errors: body.error.flatten().fieldErrors,
        });
      }
      const data = await this.preferencesService.update(params.data.userId, body.data);
      return res.status(200).json({ success: true, message: "Preferences updated successfully", data });
    } catch (error) {
      return this.handleError(res, error, "update");
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const params = preferenceUserIdParamSchema.safeParse(req.params);
      if (!params.success) return this.invalidParams(res, params.error.flatten().fieldErrors);
      await this.preferencesService.delete(params.data.userId);
      return res.status(200).json({ success: true, message: "Preferences deleted successfully" });
    } catch (error) {
      return this.handleError(res, error, "delete");
    }
  }

  private invalidParams(res: Response, errors: Record<string, string[] | undefined>) {
    return res.status(400).json({ success: false, message: "Invalid user ID format (UUID required)", errors });
  }
}
