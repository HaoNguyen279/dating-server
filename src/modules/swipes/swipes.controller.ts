import type { Request, Response } from "express";
import {
  createSwipeSchema,
  listSwipesQuerySchema,
  swipeUserIdParamSchema,
} from "./swipes.validation.js";
import { SwipesHttpError, SwipesService } from "./swipes.service.js";

export class SwipesController {
  constructor(private readonly swipesService: SwipesService) {}

  private handleError(res: Response, error: unknown, context: string) {
    if (error instanceof SwipesHttpError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error(`SwipesController.${context} error:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  async createSwipe(req: Request, res: Response) {
    try {
      const result = createSwipeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid swipe data",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const swipeResult = await this.swipesService.createSwipe(result.data);

      return res.status(201).json({
        success: true,
        message: swipeResult.isMatch ? "It's a Match!" : "Swipe recorded successfully",
        ...swipeResult,
      });
    } catch (error) {
      return this.handleError(res, error, "createSwipe");
    }
  }

  async getSwipesByUserId(req: Request, res: Response) {
    try {
      const rawUserId = req.params.userId || req.params.id;
      const paramResult = swipeUserIdParamSchema.safeParse({ userId: rawUserId });
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const queryResult = listSwipesQuerySchema.safeParse(req.query);
      const query = queryResult.success ? queryResult.data : undefined;

      const result = await this.swipesService.getSwipesByUserId(paramResult.data.userId, query);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(res, error, "getSwipesByUserId");
    }
  }

  async getUsersSwipedMe(req: Request, res: Response) {
    try {
      // Support path param, query param, or fallback to body for backwards compatibility
      const rawUserId = req.params.userId || req.query.userId || req.body?.id;
      const paramResult = swipeUserIdParamSchema.safeParse({ userId: rawUserId });
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required in param, query, or body)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const queryResult = listSwipesQuerySchema.safeParse(req.query);
      const query = queryResult.success ? queryResult.data : undefined;

      const result = await this.swipesService.getUserSwipedMe(paramResult.data.userId, query);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(res, error, "getUsersSwipedMe");
    }
  }
}
