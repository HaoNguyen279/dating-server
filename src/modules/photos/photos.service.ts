import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { cacheService } from "../../lib/cache.js";
import { invalidateUserRecommendationsCache } from "../recommendations/recommendations.service.js";
import {
  PhotoLimitError,
  PhotosRepository,
} from "./photos.repository.js";

export class PhotoManagementError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "PhotoManagementError";
  }
}

export class PhotosService {
  constructor(private readonly photosRepository: PhotosRepository) {}

  async list(userId: string) {
    return this.photosRepository.listForUser(userId);
  }

  async upload(userId: string, file: Express.Multer.File) {
    const cloudinaryConfig = this.getCloudinaryConfig();
    cloudinary.config(cloudinaryConfig);

    let uploadResult: { secure_url: string; public_id: string };
    try {
      uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "dating-app/users",
            resource_type: "image",
            allowed_formats: ["jpg", "jpeg", "png", "webp", "avif", "heic", "heif"],
          },
          (error, result) => {
            if (error) return reject(error);
            if (!result?.secure_url || !result.public_id) {
              return reject(new Error("Cloudinary returned incomplete image metadata"));
            }
            resolve(result as { secure_url: string; public_id: string });
          },
        );

        Readable.from(file.buffer).pipe(uploadStream);
      });
    } catch (error) {
      console.error("Cloudinary photo upload failed:", error);
      throw new PhotoManagementError(502, "Unable to upload photo to Cloudinary");
    }

    try {
      const photo = await this.photosRepository.createForUser(
        userId,
        uploadResult.secure_url,
        uploadResult.public_id,
      );
      if (!photo) {
        await this.destroyUploadedAsset(uploadResult.public_id);
        throw new PhotoManagementError(404, "User not found");
      }
      await this.invalidateUserCaches(userId);
      return photo;
    } catch (error) {
      if (error instanceof PhotoLimitError) {
        await this.destroyUploadedAsset(uploadResult.public_id);
        throw new PhotoManagementError(409, error.message);
      }
      if (error instanceof PhotoManagementError) throw error;

      await this.destroyUploadedAsset(uploadResult.public_id);
      console.error("Saving uploaded photo metadata failed:", error);
      throw new PhotoManagementError(500, "Photo upload could not be saved");
    }
  }

  async setOrder(userId: string, orderedPhotoIds: string[]) {
    const photos = await this.photosRepository.setOrder(userId, orderedPhotoIds);
    await this.invalidateUserCaches(userId);
    return photos;
  }

  async setPrimary(userId: string, photoId: string) {
    const photos = await this.photosRepository.listForUser(userId);
    if (!photos.some((photo) => photo.id === photoId)) {
      throw new PhotoManagementError(404, "Photo not found");
    }
    return this.setOrder(userId, [
      photoId,
      ...photos.filter((photo) => photo.id !== photoId).map((photo) => photo.id),
    ]);
  }

  async delete(userId: string, photoId: string) {
    const photo = await this.photosRepository.getOwnedPhoto(userId, photoId);
    if (!photo) throw new PhotoManagementError(404, "Photo not found");

    const cloudinaryPublicId = photo.cloudinary_public_id ?? this.publicIdFromLegacyUrl(photo.url);
    let cloudinaryDeleted = false;
    if (cloudinaryPublicId) {
      cloudinary.config(this.getCloudinaryConfig());
      try {
        const result = await cloudinary.uploader.destroy(cloudinaryPublicId, {
          resource_type: "image",
          invalidate: true,
        });
        if (result.result !== "ok" && result.result !== "not found") {
          throw new Error(`Unexpected Cloudinary destroy result: ${result.result}`);
        }
        cloudinaryDeleted = result.result === "ok";
      } catch (error) {
        console.error("Cloudinary photo deletion failed:", error);
        throw new PhotoManagementError(502, "Unable to delete photo from Cloudinary");
      }
    }

    await this.photosRepository.deleteForUser(userId, photoId);
    await this.invalidateUserCaches(userId);
    return {
      id: photo.id,
      cloudinaryDeleted,
      legacyAsset: !cloudinaryPublicId,
    };
  }

  private publicIdFromLegacyUrl(url: string) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    if (!cloudName) return null;

    try {
      const parsed = new URL(url);
      if (parsed.hostname !== "res.cloudinary.com") return null;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const uploadIndex = parts.indexOf("upload");
      if (
        parts[0] !== cloudName ||
        uploadIndex < 2 ||
        parts[uploadIndex - 1] !== "image"
      ) {
        return null;
      }

      const assetParts = parts.slice(uploadIndex + 1);
      const versionIndex = assetParts.findIndex((part) => /^v\d+$/.test(part));
      const publicIdParts = versionIndex >= 0
        ? assetParts.slice(versionIndex + 1)
        : assetParts;
      if (publicIdParts.length === 0) return null;

      const lastPartIndex = publicIdParts.length - 1;
      publicIdParts[lastPartIndex] = publicIdParts[lastPartIndex].replace(/\.[^.]+$/, "");
      const publicId = publicIdParts.join("/");
      return publicId || null;
    } catch {
      return null;
    }
  }

  private async invalidateUserCaches(userId: string) {
    await Promise.all([
      cacheService.delByPattern(`profile:v1:${userId}*`),
      cacheService.delByPattern(`profile:${userId}*`),
      invalidateUserRecommendationsCache(userId),
    ]);
  }

  private getCloudinaryConfig() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new PhotoManagementError(503, "Cloudinary server credentials are not configured");
    }

    return {
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    };
  }

  private async destroyUploadedAsset(publicId: string) {
    try {
      cloudinary.config(this.getCloudinaryConfig());
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    } catch (error) {
      console.error("Cloudinary cleanup after failed photo upload failed:", error);
    }
  }
}
