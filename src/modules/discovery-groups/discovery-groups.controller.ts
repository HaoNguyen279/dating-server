import type { Request, Response } from "express";
import { getChatAuth } from "../chat/chat.auth.js";
import { recommendationImpressionSchema, recommendationQuerySchema } from "../recommendations/recommendations.validation.js";
import { RecommendationsHttpError, RecommendationsService } from "../recommendations/recommendations.service.js";
import { DiscoveryGroupsHttpError, DiscoveryGroupsService } from "./discovery-groups.service.js";
import { discoveryGroupSlugParamSchema } from "./discovery-groups.validation.js";

export class DiscoveryGroupsController {
  constructor(
    private readonly groupsService: DiscoveryGroupsService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  private handleError(res: Response, error: unknown, context: string) {
    if (error instanceof DiscoveryGroupsHttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    if (error instanceof RecommendationsHttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error(`DiscoveryGroupsController.${context} error:`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }

  async list(req: Request, res: Response) {
    try {
      const data = await this.groupsService.list(getChatAuth(res).userId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.handleError(res, error, "list");
    }
  }

  async listRelationshipIntentions(_req: Request, res: Response) {
    try {
      const data = await this.groupsService.listRelationshipIntentionCounts();
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.handleError(res, error, "listRelationshipIntentions");
    }
  }

  async getRecommendations(req: Request, res: Response) {
    try {
      const parsed = discoveryGroupSlugParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid group slug" });
      }
      const auth = getChatAuth(res);
      const query = recommendationQuerySchema.safeParse({
        ...req.query,
        userId: auth.userId,
        groupSlug: parsed.data.slug,
      });
      if (!query.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid recommendation query parameters",
          errors: query.error.flatten().fieldErrors,
        });
      }
      const { userId, ...options } = query.data;
      const result = await this.recommendationsService.getRecommendations(userId!, options);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return this.handleError(res, error, "getRecommendations");
    }
  }

  async getRelationshipIntentionRecommendations(req: Request, res: Response) {
    try {
      const auth = getChatAuth(res);
      const query = recommendationQuerySchema.safeParse({
        ...req.query,
        userId: auth.userId,
      });
      if (!query.success || !query.data.relationshipIntention) {
        return res.status(400).json({
          success: false,
          message: "A valid relationshipIntention is required",
          errors: query.success ? undefined : query.error.flatten().fieldErrors,
        });
      }
      const { userId, ...options } = query.data;
      const result = await this.recommendationsService.getRecommendations(userId!, options);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      return this.handleError(res, error, "getRelationshipIntentionRecommendations");
    }
  }

  async recordImpressions(req: Request, res: Response) {
    try {
      const body = recommendationImpressionSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid recommendation impression data",
          errors: body.error.flatten().fieldErrors,
        });
      }
      const result = await this.recommendationsService.recordImpressions(
        getChatAuth(res).userId,
        body.data,
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return this.handleError(res, error, "recordImpressions");
    }
  }
}
