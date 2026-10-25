import { Request, Response } from "express";
import { UsersService, HttpError } from "./users.service.js";
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  userIdParamSchema,
  listUsersQuerySchema,
  checkAvailabilityQuerySchema,
  deleteUserQuerySchema,
} from "./users.validation.js";

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private handleError(res: Response, error: unknown, context: string) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    console.error(`UsersController.${context} error:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  async createUser(req: Request, res: Response) {
    try {
      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const user = await this.usersService.createUser(result.data);
      return res.status(201).json({
        success: true,
        message: "User created successfully",
        data: user,
      });
    } catch (error) {
      return this.handleError(res, error, "createUser");
    }
  }

  async getUsers(req: Request, res: Response) {
    try {
      const result = listUsersQuerySchema.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid query parameters",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const response = await this.usersService.getUsers(result.data);
      return res.status(200).json({
        success: true,
        ...response,
      });
    } catch (error) {
      return this.handleError(res, error, "getUsers");
    }
  }

  async checkAvailability(req: Request, res: Response) {
    try {
      const result = checkAvailabilityQuerySchema.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid availability query parameters",
          errors: result.error.flatten().fieldErrors,
        });
      }

      const availability = await this.usersService.checkAvailability(result.data);
      return res.status(200).json({
        success: true,
        data: availability,
      });
    } catch (error) {
      return this.handleError(res, error, "checkAvailability");
    }
  }

  async getUserById(req: Request, res: Response) {
    try {
      const paramResult = userIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const includeRelations =
        req.query.includeRelations === "true" || req.query.includeRelations === "1";

      const user = await this.usersService.getUserById(paramResult.data.id, includeRelations);
      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      return this.handleError(res, error, "getUserById");
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const paramResult = userIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const bodyResult = updateUserSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user update data",
          errors: bodyResult.error.flatten().fieldErrors,
        });
      }

      const updatedUser = await this.usersService.updateUser(
        paramResult.data.id,
        bodyResult.data
      );

      return res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: updatedUser,
      });
    } catch (error) {
      return this.handleError(res, error, "updateUser");
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const paramResult = userIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const bodyResult = updateStatusSchema.safeParse(req.body);
      if (!bodyResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value",
          errors: bodyResult.error.flatten().fieldErrors,
        });
      }

      const updatedUser = await this.usersService.updateStatus(
        paramResult.data.id,
        bodyResult.data.status
      );

      return res.status(200).json({
        success: true,
        message: `User status changed to '${bodyResult.data.status}'`,
        data: updatedUser,
      });
    } catch (error) {
      return this.handleError(res, error, "updateStatus");
    }
  }

  async recordActivity(req: Request, res: Response) {
    try {
      const paramResult = userIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const updatedUser = await this.usersService.recordActivity(paramResult.data.id);
      return res.status(200).json({
        success: true,
        message: "Activity recorded successfully",
        data: updatedUser,
      });
    } catch (error) {
      return this.handleError(res, error, "recordActivity");
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const paramResult = userIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID format (UUID required)",
          errors: paramResult.error.flatten().fieldErrors,
        });
      }

      const queryResult = deleteUserQuerySchema.safeParse(req.query);
      const hard = queryResult.success ? queryResult.data.hard : false;

      const result = await this.usersService.deleteUser(paramResult.data.id, hard);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      return this.handleError(res, error, "deleteUser");
    }
  }
}
