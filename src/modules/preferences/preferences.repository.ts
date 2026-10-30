import prisma from "../../lib/prisma.js";
import type { interested_type, Prisma } from "../../generated/prisma/client.js";

export type PreferenceData = {
  interested_in?: interested_type;
  age_min?: number;
  age_max?: number;
  max_distance_km?: number;
  show_me?: boolean;
  interested_languages?: string[];
};

export type PreferenceWhere = Prisma.preferencesWhereInput;

export class PreferencesRepository {
  async findAll(options: {
    skip: number;
    take: number;
    where: PreferenceWhere;
    sortOrder: "asc" | "desc";
  }) {
    return prisma.preferences.findMany({
      where: options.where,
      skip: options.skip,
      take: options.take,
      orderBy: { updated_at: options.sortOrder },
    });
  }

  async count(where: PreferenceWhere) {
    return prisma.preferences.count({ where });
  }

  async findByUserId(user_id: string) {
    return prisma.preferences.findUnique({ where: { user_id } });
  }

  async userExists(id: string) {
    const user = await prisma.users.findUnique({
      where: { id },
      select: { id: true },
    });
    return user !== null;
  }

  async create(user_id: string, data: PreferenceData) {
    return prisma.preferences.create({
      data: { user_id, ...data },
    });
  }

  async upsertByUserId(user_id: string, data: PreferenceData) {
    return prisma.preferences.upsert({
      where: { user_id },
      create: { user_id, ...data },
      update: { ...data, updated_at: new Date() },
    });
  }

  async updateByUserId(user_id: string, data: PreferenceData) {
    return prisma.preferences.update({
      where: { user_id },
      data: { ...data, updated_at: new Date() },
    });
  }

  async deleteByUserId(user_id: string) {
    return prisma.preferences.delete({ where: { user_id } });
  }
}
