import type { Request, Response } from "express";
import { getChatAuth } from "../chat/chat.auth.js";
import {
  PhotoManagementError,
  PhotosService,
} from "./photos.service.js";
import { PhotoOrderError } from "./photos.repository.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  async list(_req: Request, res: Response) {
    try {
      const { userId } = getChatAuth(res);
      const photos = await this.photosService.list(userId);
      return res.status(200).json({ success: true, data: photos });
    } catch (error) {
      return this.handleError(res, error, "list");
    }
  }

  async upload(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "An image file is required in the 'image' field",
      });
    }

    try {
      const { userId } = getChatAuth(res);
      const photo = await this.photosService.upload(userId, req.file);
      return res.status(201).json({
        success: true,
        message: "Photo uploaded successfully",
        data: photo,
      });
    } catch (error) {
      return this.handleError(res, error, "upload");
    }
  }

  async setOrder(req: Request, res: Response) {
    const photoIds: unknown = req.body?.photoIds;
    if (
      !Array.isArray(photoIds) ||
      photoIds.length > 9 ||
      !photoIds.every((id) => typeof id === "string" && UUID_PATTERN.test(id))
    ) {
      return res.status(400).json({
        success: false,
        message: "photoIds must be an array of at most 9 photo UUIDs",
      });
    }

    try {
      const { userId } = getChatAuth(res);
      const photos = await this.photosService.setOrder(userId, photoIds);
      return res.status(200).json({ success: true, data: photos });
    } catch (error) {
      return this.handleError(res, error, "setOrder");
    }
  }

  async setPrimary(req: Request, res: Response) {
    const photoId = this.getPhotoId(req);
    if (!photoId) {
      return res.status(400).json({ success: false, message: "Invalid photo ID" });
    }

    try {
      const { userId } = getChatAuth(res);
      const photos = await this.photosService.setPrimary(userId, photoId);
      return res.status(200).json({ success: true, data: photos });
    } catch (error) {
      return this.handleError(res, error, "setPrimary");
    }
  }

  async delete(req: Request, res: Response) {
    const photoId = this.getPhotoId(req);
    if (!photoId) {
      return res.status(400).json({ success: false, message: "Invalid photo ID" });
    }

    try {
      const { userId } = getChatAuth(res);
      const result = await this.photosService.delete(userId, photoId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return this.handleError(res, error, "delete");
    }
  }

  private getPhotoId(req: Request) {
    const photoId = req.params.photoId;
    return typeof photoId === "string" && UUID_PATTERN.test(photoId)
      ? photoId
      : null;
  }

  private handleError(res: Response, error: unknown, operation: string) {
    if (error instanceof PhotoManagementError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    if (error instanceof PhotoOrderError) {
      return res.status(400).json({ success: false, message: error.message });
    }

    console.error(`PhotosController.${operation} error:`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
