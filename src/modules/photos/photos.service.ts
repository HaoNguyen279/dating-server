import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { PhotoLimitError, PhotosRepository } from "./photos.repository.js";

export class PhotoUploadError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "PhotoUploadError";
  }
}

export class PhotosService {
  constructor(private readonly photosRepository: PhotosRepository) {}

  async upload(userId: string, file: Express.Multer.File) {
    const position = await this.photosRepository.getNextPosition(userId);
    if (position === null) {
      throw new PhotoUploadError(404, "User not found");
    }
    if (position > 8) {
      throw new PhotoUploadError(409, "A user can upload at most 9 photos");
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET?.trim();

    if (!cloudName || !apiKey || !uploadPreset) {
      throw new PhotoUploadError(503, "Cloudinary upload is not configured");
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey });

    let uploadResult: { secure_url: string };
    try {
      uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            upload_preset: uploadPreset,
            folder: "dating-app/users",
            resource_type: "image",
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url) return reject(new Error("Cloudinary returned no image URL"));
            resolve(result as { secure_url: string });
          }
        );

        Readable.from(file.buffer).pipe(uploadStream);
      });
    } catch (error) {
      console.error("Cloudinary photo upload failed:", error);
      throw new PhotoUploadError(502, "Unable to upload photo to Cloudinary");
    }

    try {
      const photo = await this.photosRepository.createForUser(userId, uploadResult.secure_url);
      if (!photo) {
        throw new PhotoUploadError(404, "User not found");
      }
      return photo;
    } catch (error) {
      if (error instanceof PhotoLimitError || error instanceof PhotoUploadError) throw error;
      console.error("Saving uploaded photo URL failed:", error);
      throw new PhotoUploadError(500, "Photo was uploaded but its URL could not be saved");
    }
  }
}
