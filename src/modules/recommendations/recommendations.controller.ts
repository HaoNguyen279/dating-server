import type { Request, Response } from "express";
import { RecommendationsHttpError, RecommendationsService } from "./recommendations.service.js";
import {
  recommendationImpressionSchema,
  recommendationQuerySchema,
  recommendationUserIdParamSchema,
} from "./recommendations.validation.js";

export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  private handleError(res: Response, error: unknown) {
    if (error instanceof RecommendationsHttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error("RecommendationsController.getRecommendations error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }

  async getRecommendations(req: Request, res: Response) {
    try {
      const params = recommendationUserIdParamSchema.safeParse(req.params);
      const rawUserId = params.success ? params.data.userId : req.query.userId;
      const query = recommendationQuerySchema.safeParse({ ...req.query, userId: rawUserId });
      if (!query.success || !rawUserId) {
        return res.status(400).json({
          success: false,
          message: "A valid userId is required",
          errors: query.success ? undefined : query.error.flatten().fieldErrors,
        });
      }

      const { userId, ...options } = query.data;
      const result = await this.recommendationsService.getRecommendations(userId!, options);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return this.handleError(res, error);
    }
  }

  async recordImpressions(req: Request, res: Response) {
    try {
      const params = recommendationUserIdParamSchema.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: params.error.flatten().fieldErrors,
        });
      }

      const body = recommendationImpressionSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid recommendation impression data",
          errors: body.error.flatten().fieldErrors,
        });
      }

      const result = await this.recommendationsService.recordImpressions(
        params.data.userId,
        body.data,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return this.handleError(res, error);
    }
  }
}
