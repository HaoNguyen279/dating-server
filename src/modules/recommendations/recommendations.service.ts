import { RecommendationsRepository } from "./recommendations.repository.js";
import type { RecommendationQuery } from "./recommendations.validation.js";

export class RecommendationsHttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "RecommendationsHttpError";
  }
}

export class RecommendationsService {
  constructor(private readonly recommendationsRepo: RecommendationsRepository) {}

  async getRecommendations(userId: string, query: RecommendationQuery) {
    const user = await this.recommendationsRepo.findDiscoveryContext(userId);
    if (!user || user.status !== "active") {
      throw new RecommendationsHttpError(404, "Active user not found");
    }
    if (!user.profiles) {
      throw new RecommendationsHttpError(400, "Create a profile before using discovery");
    }

    const preferences = user.preferences;
    const today = new Date();
    const minAge = preferences?.age_min ?? 18;
    const maxAge = preferences?.age_max ?? 99;
    const maxBirthDate = yearsBefore(today, minAge);
    const minBirthDate = yearsBefore(today, maxAge + 1);
    const swipedUserIds = await this.recommendationsRepo.findSwipedUserIds(userId);

    const data = await this.recommendationsRepo.findCandidates({
      userId,
      swipedUserIds,
      minBirthDate,
      maxBirthDate,
      interestedIn: preferences?.interested_in ?? "everyone",
      cursor: query.cursor,
      limit: query.limit,
    });

    const nextCursor = data.length === query.limit ? data[data.length - 1].user_id : null;
    return {
      data,
      pagination: {
        limit: query.limit,
        nextCursor,
      },
    };
  }
}

function yearsBefore(date: Date, years: number) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() - years);
  return result;
}
