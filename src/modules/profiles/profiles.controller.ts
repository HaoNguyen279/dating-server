import type { Request, Response } from "express";
import { getChatAuth } from "../chat/chat.auth.js";
import {
  createProfileSchema,
  listProfilesQuerySchema,
  profileIdParamSchema,
  profileUserIdParamSchema,
  updateProfileSchema,
  relationshipIntentionUpdateSchema,
} from "./profiles.validation.js";
import { ProfilesHttpError, ProfilesService } from "./profiles.service.js";

export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  private handleError(res: Response, error: unknown, context: string) {
    if (error instanceof ProfilesHttpError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error(`ProfilesController.${context} error:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  // Backwards compatibility
  async getAllProfiles(req: Request, res: Response) {
    return this.list(req, res);
  }

  async list(req: Request, res: Response) {
    try {
      const parsed = listProfilesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await this.profilesService.list(parsed.data);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(res, error, "list");
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const paramResult = profileIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const includeUser = req.query.includeUser === "true" || req.query.includeUser === "1";
      const includePhotos = req.query.includePhotos === "true" || req.query.includePhotos === "1";

      const profile = await this.profilesService.getById(paramResult.data.id, includeUser, includePhotos);
      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      return this.handleError(res, error, "getById");
    }
  }

  async getByUserId(req: Request, res: Response) {
    try {
      const paramResult = profileUserIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const includeUser = req.query.includeUser === "true" || req.query.includeUser === "1";
      const includePhotos = req.query.includePhotos === "true" || req.query.includePhotos === "1";

      const profile = await this.profilesService.getByUserId(
        paramResult.data.userId,
        includeUser,
        includePhotos
      );
      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      return this.handleError(res, error, "getByUserId");
    }
  }

  async create(req: Request, res: Response) {
    try {
      const bodyResult = createProfileSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile data",
          errors: bodyResult.error.flatten().fieldErrors,
        });
      }

      const profile = await this.profilesService.create(bodyResult.data);
      return res.status(201).json({
        success: true,
        message: "Profile created successfully",
        data: profile,
      });
    } catch (error) {
      return this.handleError(res, error, "create");
    }
  }

  async updateById(req: Request, res: Response) {
    try {
      const paramResult = profileIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const bodyResult = updateProfileSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile update data",
          errors: bodyResult.error.flatten().fieldErrors,
        });
      }

      const updated = await this.profilesService.updateById(paramResult.data.id, bodyResult.data);
      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updated,
      });
    } catch (error) {
      return this.handleError(res, error, "updateById");
    }
  }

  async updateByUserId(req: Request, res: Response) {
    try {
      const paramResult = profileUserIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const bodyResult = updateProfileSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile update data",
          errors: bodyResult.error.flatten().fieldErrors,
        });
      }

      const updated = await this.profilesService.updateByUserId(paramResult.data.userId, bodyResult.data);
      return res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: updated,
      });
    } catch (error) {
      return this.handleError(res, error, "updateByUserId");
    }
  }

  async updateMyRelationshipIntention(req: Request, res: Response) {
    try {
      const bodyResult = relationshipIntentionUpdateSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid relationship intention",
          errors: bodyResult.error.flatten().fieldErrors,
        });
      }

      const userId = getChatAuth(res).userId;
      const profile = await this.profilesService.updateByUserId(userId, bodyResult.data);
      return res.status(200).json({
        success: true,
        message: "Relationship intention updated successfully",
        data: profile,
      });
    } catch (error) {
      return this.handleError(res, error, "updateMyRelationshipIntention");
    }
  }

  async upsertByUserId(req: Request, res: Response) {
    try {
      const paramResult = profileUserIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const payload = {
        ...req.body,
        user_id: paramResult.data.userId,
      };

      const bodyResult = createProfileSchema.safeParse(payload);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile data",
          errors: bodyResult.error.flatten().fieldErrors,
        });
      }

      const upserted = await this.profilesService.upsertByUserId(paramResult.data.userId, bodyResult.data);
      return res.status(200).json({
        success: true,
        message: "Profile upserted successfully",
        data: upserted,
      });
    } catch (error) {
      return this.handleError(res, error, "upsertByUserId");
    }
  }

  async deleteById(req: Request, res: Response) {
    try {
      const paramResult = profileIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const result = await this.profilesService.deleteById(paramResult.data.id);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(res, error, "deleteById");
    }
  }

  async deleteByUserId(req: Request, res: Response) {
    try {
      const paramResult = profileUserIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const result = await this.profilesService.deleteByUserId(paramResult.data.userId);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(res, error, "deleteByUserId");
    }
  }
}
