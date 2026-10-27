import prisma from "../../lib/prisma.js";
import type { gender_type } from "../../generated/prisma/enums.js";

export class RecommendationsRepository {
  async findDiscoveryContext(userId: string) {
    return prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        status: true,
        profiles: {
          select: { gender: true, birth_date: true },
        },
        preferences: {
          select: { interested_in: true, age_min: true, age_max: true },
        },
      },
    });
  }

  async findSwipedUserIds(userId: string) {
    const swipes = await prisma.swipes.findMany({
      where: { swiper_id: userId },
      select: { swiped_id: true },
    });
    return swipes.map(({ swiped_id }) => swiped_id);
  }

  async findCandidates(options: {
    userId: string;
    swipedUserIds: string[];
    minBirthDate: Date;
    maxBirthDate: Date;
    interestedIn: "male" | "female" | "everyone";
    cursor?: string;
    limit: number;
  }) {
    return prisma.profiles.findMany({
      where: {
        user_id: {
          not: options.userId,
          notIn: options.swipedUserIds,
          ...(options.cursor ? { gt: options.cursor } : {}),
        },
        birth_date: {
          gte: options.minBirthDate,
          lte: options.maxBirthDate,
        },
        ...(options.interestedIn !== "everyone" && {
          gender: options.interestedIn as gender_type,
        }),
        users: {
          is: {
            status: "active",
            OR: [
              { preferences: { is: null } },
              { preferences: { is: { show_me: true } } },
            ],
          },
        },
      },
      orderBy: { user_id: "asc" },
      take: options.limit,
      include: {
        users: {
          select: {
            id: true,
            photos: {
              orderBy: [{ is_primary: "desc" }, { position: "asc" }],
              select: {
                id: true,
                url: true,
                position: true,
                is_primary: true,
              },
            },
          },
        },
      },
    });
  }
}
