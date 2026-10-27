import type { Request, Response } from "express";
import { PhotosService, PhotoUploadError } from "./photos.service.js";

export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  async upload(req: Request, res: Response) {
    const userId = req.params.id;
    if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID format (UUID required)" });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "An image file is required in the 'image' field" });
    }

    try {
      const photo = await this.photosService.upload(userId, req.file);
      return res.status(201).json({
        success: true,
        message: "Photo uploaded successfully",
        data: photo,
      });
    } catch (error) {
      if (error instanceof PhotoUploadError) {
        return res.status(error.statusCode).json({ success: false, message: error.message });
      }
      if (error instanceof Error && error.name === "PhotoLimitError") {
        return res.status(409).json({ success: false, message: error.message });
      }

      console.error("PhotosController.upload error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }
}
