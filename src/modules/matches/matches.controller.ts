import type { Request, Response } from "express";
import {
  listMatchesQuerySchema,
  matchIdParamSchema,
  matchUserIdParamSchema,
} from "./matches.validation.js";
import { MatchesHttpError, MatchesService } from "./matches.service.js";

export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  private handleError(res: Response, error: unknown, context: string) {
    if (error instanceof MatchesHttpError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error(`MatchesController.${context} error:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  async getById(req: Request, res: Response) {
    try {
      const paramResult = matchIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid match ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const match = await this.matchesService.getById(paramResult.data.id);
      return res.status(200).json({
        success: true,
        data: match,
      });
    } catch (error) {
      return this.handleError(res, error, "getById");
    }
  }

  async getByUserId(req: Request, res: Response) {
    try {
      const paramResult = matchUserIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const queryResult = listMatchesQuerySchema.safeParse(req.query);
      const query = queryResult.success ? queryResult.data : undefined;

      const result = await this.matchesService.getByUserId(paramResult.data.userId, query);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(res, error, "getByUserId");
    }
  }

  async unmatch(req: Request, res: Response) {
    try {
      const paramResult = matchIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid match ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const result = await this.matchesService.unmatch(paramResult.data.id);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(res, error, "unmatch");
    }
  }
}
