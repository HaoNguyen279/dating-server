import prisma from "../../lib/prisma.js";
import type { gender_type } from "../../generated/prisma/enums.js";

export interface ProfileData {
  display_name?: string;
  birth_date?: Date;
  gender?: gender_type;
  bio?: string | null;
  job_title?: string | null;
  height_cm?: number | null;
  city?: string | null;
  ward?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_verified?: boolean;
  education?: string | null;
  pet?: string | null;
  life_style?: string[];
  hobbies?: Array<{ id: string; name: string; category: string }>;
  languages?: string[];
}

export interface FindProfilesOptions {
  skip: number;
  take: number;
  where?: {
    gender?: gender_type;
    city?: { contains: string; mode: "insensitive" };
    ward?: { contains: string; mode: "insensitive" };
    is_verified?: boolean;
    birth_date?: {
      gte?: Date;
      lte?: Date;
    };
    OR?: Array<{
      display_name?: { contains: string; mode: "insensitive" };
      city?: { contains: string; mode: "insensitive" };
      ward?: { contains: string; mode: "insensitive" };
      job_title?: { contains: string; mode: "insensitive" };
    }>;
  };
  orderBy?: {
    [key: string]: "asc" | "desc";
  };
  includeUser?: boolean;
  includePhotos?: boolean;
}

const safeUserSelect = {
  id: true,
  email: true,
  phone: true,
  status: true,
  last_active_at: true,
  created_at: true,
};

export class ProfilesRepository {
  async findById(id: string, includeUser = false, includePhotos = false) {
    return prisma.profiles.findUnique({
      where: { id },
      include: {
        users: includeUser
          ? {
              select: {
                ...safeUserSelect,
                photos: includePhotos,
              },
            }
          : false,
      },
    });
  }

  async findByUserId(userId: string, includeUser = false, includePhotos = false) {
    return prisma.profiles.findUnique({
      where: { user_id: userId },
      include: {
        users: includeUser
          ? {
              select: {
                ...safeUserSelect,
                photos: includePhotos,
              },
            }
          : false,
      },
    });
  }

  async findAll(options: FindProfilesOptions) {
    return prisma.profiles.findMany({
      skip: options.skip,
      take: options.take,
      where: options.where,
      orderBy: options.orderBy,
      include: {
        users: options.includeUser
          ? {
              select: {
                ...safeUserSelect,
                photos: options.includePhotos,
              },
            }
          : false,
      },
    });
  }

  async count(where?: FindProfilesOptions["where"]): Promise<number> {
    return prisma.profiles.count({ where });
  }

  async create(userId: string, data: ProfileData & { display_name: string; birth_date: Date; gender: gender_type }) {
    return prisma.profiles.create({
      data: {
        user_id: userId,
        display_name: data.display_name,
        birth_date: data.birth_date,
        gender: data.gender,
        bio: data.bio ?? null,
        job_title: data.job_title ?? null,
        height_cm: data.height_cm ?? null,
        city: data.city ?? null,
        ward: data.ward ?? null,
        latitude: data.latitude !== undefined && data.latitude !== null ? data.latitude : null,
        longitude: data.longitude !== undefined && data.longitude !== null ? data.longitude : null,
        is_verified: data.is_verified ?? false,
        education: data.education ?? null,
        pet: data.pet ?? null,
        life_style: data.life_style ?? [],
        hobbies: data.hobbies ?? [],
        languages: data.languages ?? [],
      },
    });
  }

  async updateById(id: string, data: ProfileData) {
    return prisma.profiles.update({
      where: { id },
      data,
    });
  }

  async updateByUserId(userId: string, data: ProfileData) {
    return prisma.profiles.update({
      where: { user_id: userId },
      data,
    });
  }

  async upsertByUserId(
    userId: string,
    data: ProfileData & { display_name: string; birth_date: Date; gender: gender_type }
  ) {
    return prisma.profiles.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        display_name: data.display_name,
        birth_date: data.birth_date,
        gender: data.gender,
        bio: data.bio ?? null,
        job_title: data.job_title ?? null,
        height_cm: data.height_cm ?? null,
        city: data.city ?? null,
        ward: data.ward ?? null,
        latitude: data.latitude !== undefined && data.latitude !== null ? data.latitude : null,
        longitude: data.longitude !== undefined && data.longitude !== null ? data.longitude : null,
        is_verified: data.is_verified ?? false,
        education: data.education ?? null,
        pet: data.pet ?? null,
        life_style: data.life_style ?? [],
        hobbies: data.hobbies ?? [],
        languages: data.languages ?? [],
      },
      update: data,
    });
  }

  async deleteById(id: string) {
    return prisma.profiles.delete({
      where: { id },
    });
  }

  async deleteByUserId(userId: string) {
    return prisma.profiles.delete({
      where: { user_id: userId },
    });
  }

  async userExists(userId: string): Promise<boolean> {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return Boolean(user);
  }
}
