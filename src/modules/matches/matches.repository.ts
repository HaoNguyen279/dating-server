import prisma from "../../lib/prisma.js";
import type { match_status } from "../../generated/prisma/enums.js";

const safeUserSelect = {
  id: true,
  status: true,
  profiles: {
    select: {
      display_name: true,
      birth_date: true,
      gender: true,
      bio: true,
      city: true,
      ward: true,
      hobbies: true,
      job_title: true,
      is_verified: true,
    },
  },
  photos: {
    select: {
      url: true,
      is_primary: true,
      position: true,
    },
  },
};

export class MatchesRepository {
  async findById(id: string) {
    return prisma.matches.findUnique({
      where: { id },
      include: {
        conversations: true,
        users_matches_user1_idTousers: {
          select: safeUserSelect,
        },
        users_matches_user2_idTousers: {
          select: safeUserSelect,
        },
      },
    });
  }

  async findByUserId(
    userId: string,
    options: {
      skip: number;
      take: number;
      status?: match_status;
      sortOrder?: "asc" | "desc";
    }
  ) {
    const where: any = {
      OR: [{ user1_id: userId }, { user2_id: userId }],
    };

    if (options.status) {
      where.status = options.status;
    }

    return prisma.matches.findMany({
      where,
      skip: options.skip,
      take: options.take,
      orderBy: {
        matched_at: options.sortOrder ?? "desc",
      },
      include: {
        conversations: {
          select: {
            id: true,
            last_message_at: true,
            created_at: true,
          },
        },
        users_matches_user1_idTousers: {
          select: safeUserSelect,
        },
        users_matches_user2_idTousers: {
          select: safeUserSelect,
        },
      },
    });
  }

  async countByUserId(userId: string, status?: match_status): Promise<number> {
    const where: any = {
      OR: [{ user1_id: userId }, { user2_id: userId }],
    };

    if (status) {
      where.status = status;
    }

    return prisma.matches.count({ where });
  }

  async unmatch(id: string) {
    return prisma.matches.update({
      where: { id },
      data: {
        status: "unmatched",
        unmatched_at: new Date(),
      },
      include: {
        conversations: true,
      },
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
