import type { match_status } from "../../generated/prisma/enums.js";
import { MatchesRepository } from "./matches.repository.js";
import type { ListMatchesQuery } from "./matches.validation.js";

export class MatchesHttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "MatchesHttpError";
  }
}

export class MatchesService {
  constructor(private readonly matchesRepo: MatchesRepository) {}

  async getById(id: string) {
    const match = await this.matchesRepo.findById(id);
    if (!match) {
      throw new MatchesHttpError(404, `Match with ID '${id}' not found`);
    }
    return match;
  }

  async getByUserId(userId: string, query?: Partial<ListMatchesQuery>) {
    const userExists = await this.matchesRepo.userExists(userId);
    if (!userExists) {
      throw new MatchesHttpError(404, `User '${userId}' not found`);
    }

    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 20));
    const skip = (page - 1) * limit;
    const status = (query?.status ?? "active") as match_status;

    const [matches, total] = await Promise.all([
      this.matchesRepo.findByUserId(userId, {
        skip,
        take: limit,
        status,
        sortOrder: query?.sortOrder ?? "desc",
      }),
      this.matchesRepo.countByUserId(userId, status),
    ]);

    // Format convenient partner object for client
    const formattedMatches = matches.map((m) => {
      const isUser1 = m.user1_id === userId;
      const partner = isUser1 ? m.users_matches_user2_idTousers : m.users_matches_user1_idTousers;
      return {
        id: m.id,
        matched_at: m.matched_at,
        unmatched_at: m.unmatched_at,
        status: m.status,
        partner: {
          id: partner.id,
          status: partner.status,
          profile: partner.profiles,
          photo: partner.photos,
        },
        conversation: m.conversations,
      };
    });

    return {
      data: formattedMatches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async unmatch(id: string) {
    const match = await this.getById(id);
    if (match.status === "unmatched") {
      throw new MatchesHttpError(400, "Match is already unmatched");
    }

    const updated = await this.matchesRepo.unmatch(id);
    return {
      message: "Unmatched successfully",
      match: updated,
    };
  }
}
