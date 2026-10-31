import type { gender_type } from "../../generated/prisma/enums.js";
import { cacheService } from "../../lib/cache.js";
import { invalidateUserRecommendationsCache } from "../recommendations/recommendations.service.js";
import {
  ProfilesRepository,
  type FindProfilesOptions,
  type ProfileData,
} from "./profiles.repository.js";
import type {
  CreateProfileInput,
  ListProfilesQuery,
  UpdateProfileInput,
} from "./profiles.validation.js";

export class ProfilesHttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "ProfilesHttpError";
  }
}

export class ProfilesService {
  constructor(private readonly profilesRepo: ProfilesRepository) {}

  async list(query: ListProfilesQuery) {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    const where: FindProfilesOptions["where"] = {};

    if (query.gender) {
      where.gender = query.gender as gender_type;
    }

    if (query.city) {
      where.city = { contains: query.city, mode: "insensitive" };
    }

    if (query.ward) {
      where.ward = { contains: query.ward, mode: "insensitive" };
    }

    if (query.is_verified !== undefined) {
      where.is_verified = query.is_verified;
    }

    if (query.minAge !== undefined || query.maxAge !== undefined) {
      const now = new Date();
      where.birth_date = {};

      if (query.minAge !== undefined) {
        // e.g. minAge 25 means born on or before 25 years ago
        const maxBirthDate = new Date(now.getFullYear() - query.minAge, now.getMonth(), now.getDate());
        where.birth_date.lte = maxBirthDate;
      }

      if (query.maxAge !== undefined) {
        // e.g. maxAge 30 means born on or after 31 years ago + 1 day
        const minBirthDate = new Date(now.getFullYear() - query.maxAge - 1, now.getMonth(), now.getDate());
        where.birth_date.gte = minBirthDate;
      }
    }

    if (query.search) {
      const term = query.search;
      where.OR = [
        { display_name: { contains: term, mode: "insensitive" } },
        { city: { contains: term, mode: "insensitive" } },
        { ward: { contains: term, mode: "insensitive" } },
        { job_title: { contains: term, mode: "insensitive" } },
      ];
    }

    const orderBy = {
      [query.sortBy]: query.sortOrder,
    };

    const [data, total] = await Promise.all([
      this.profilesRepo.findAll({
        skip,
        take: limit,
        where,
        orderBy,
        includeUser: query.includeUser,
        includePhotos: query.includePhotos,
      }),
      this.profilesRepo.count(where),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, includeUser = false, includePhotos = false) {
    const profile = await this.profilesRepo.findById(id, includeUser, includePhotos);
    if (!profile) {
      throw new ProfilesHttpError(404, `Profile with ID '${id}' not found`);
    }
    return profile;
  }

  async getByUserId(userId: string, includeUser = false, includePhotos = false) {
    const key = includeUser || includePhotos
      ? `profile:v1:${userId}:user:${includeUser}:photos:${includePhotos}`
      : `profile:v1:${userId}`;
    return cacheService.getOrSet(key, 1_800, async () => {
      const profile = await this.profilesRepo.findByUserId(userId, includeUser, includePhotos);
      if (!profile) {
        throw new ProfilesHttpError(404, `Profile for user '${userId}' not found`);
      }
      return profile;
    });
  }

  async create(input: CreateProfileInput) {
    const userExists = await this.profilesRepo.userExists(input.user_id);
    if (!userExists) {
      throw new ProfilesHttpError(404, `User '${input.user_id}' not found`);
    }

    const existingProfile = await this.profilesRepo.findByUserId(input.user_id);
    if (existingProfile) {
      throw new ProfilesHttpError(409, `Profile already exists for user '${input.user_id}'`);
    }

    const birthDate = input.birth_date instanceof Date ? input.birth_date : new Date(input.birth_date);

    const profile = await this.profilesRepo.create(input.user_id, {
      ...input,
      birth_date: birthDate,
      gender: input.gender as gender_type,
    });
    await this.invalidateUserCaches(input.user_id);
    return profile;
  }

  async updateById(id: string, input: UpdateProfileInput) {
    const existing = await this.getById(id);

    const updateData: ProfileData = {
      ...input,
      gender: input.gender ? (input.gender as gender_type) : undefined,
      birth_date: input.birth_date ? (input.birth_date instanceof Date ? input.birth_date : new Date(input.birth_date)) : undefined,
    };

    const profile = await this.profilesRepo.updateById(id, updateData);
    await this.invalidateUserCaches(existing.user_id);
    return profile;
  }

  async updateByUserId(userId: string, input: UpdateProfileInput) {
    await this.getByUserId(userId);

    const updateData: ProfileData = {
      ...input,
      gender: input.gender ? (input.gender as gender_type) : undefined,
      birth_date: input.birth_date ? (input.birth_date instanceof Date ? input.birth_date : new Date(input.birth_date)) : undefined,
    };

    const profile = await this.profilesRepo.updateByUserId(userId, updateData);
    await this.invalidateUserCaches(userId);
    return profile;
  }

  async upsertByUserId(userId: string, input: CreateProfileInput) {
    const userExists = await this.profilesRepo.userExists(userId);
    if (!userExists) {
      throw new ProfilesHttpError(404, `User '${userId}' not found`);
    }

    const birthDate = input.birth_date instanceof Date ? input.birth_date : new Date(input.birth_date);

    const profile = await this.profilesRepo.upsertByUserId(userId, {
      ...input,
      birth_date: birthDate,
      gender: input.gender as gender_type,
    });
    await this.invalidateUserCaches(userId);
    return profile;
  }

  async deleteById(id: string) {
    const profile = await this.getById(id);
    await this.profilesRepo.deleteById(id);
    await this.invalidateUserCaches(profile.user_id);
    return { message: "Profile successfully deleted", deleted: true };
  }

  async deleteByUserId(userId: string) {
    await this.getByUserId(userId);
    await this.profilesRepo.deleteByUserId(userId);
    await this.invalidateUserCaches(userId);
    return { message: "Profile successfully deleted", deleted: true };
  }

  private async invalidateUserCaches(userId: string) {
    await Promise.all([
      cacheService.delByPattern(`profile:v1:${userId}*`),
      cacheService.delByPattern(`profile:${userId}*`),
      invalidateUserRecommendationsCache(userId),
    ]);
  }
}
