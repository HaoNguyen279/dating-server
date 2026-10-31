import { createHash } from "node:crypto";
import { cacheService, type CacheService } from "../../lib/cache.js";
import { RecommendationsRepository, type RecommendationCandidate, type RecommendationViewerContext } from "./recommendations.repository.js";
import type { RecommendationQuery } from "./recommendations.validation.js";
import {
  isMutuallyEligible,
  haversineKm,
  preferencesOrDefault,
  validCoordinates,
  type RecommendationPerson,
} from "./recommendation-rules.js";
import {
  RANKING_VERSION,
  scoreRecommendationPair,
  type ScoringPerson,
} from "./recommendation-scoring.js";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const FEED_CACHE_TTL_SECONDS = 300;
const CURSOR_SEPARATOR = ":";

export class RecommendationsHttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "RecommendationsHttpError";
  }
}

export class RecommendationsService {
  constructor(
    private readonly recommendationsRepo: RecommendationsRepository,
    private readonly clock: () => Date = () => new Date(),
    private readonly cache: Pick<CacheService, "getOrSet"> = cacheService,
  ) {}

  async getRecommendations(userId: string, query: RecommendationQuery) {
    return this.cache.getOrSet(
      getRecommendationFeedCacheKey(userId, query),
      FEED_CACHE_TTL_SECONDS,
      () => this.loadRecommendations(userId, query),
    );
  }

  private async loadRecommendations(userId: string, query: RecommendationQuery) {
    const now = this.clock();
    const viewer = await this.requireActiveViewer(userId);
    const group = query.groupSlug
      ? await this.recommendationsRepo.findActiveGroupBySlug(query.groupSlug)
      : null;
    if (query.groupSlug && !group) {
      throw new RecommendationsHttpError(404, "Discovery group not found");
    }

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const session = await this.recommendationsRepo.findRankingSession(
        cursor.sessionId,
        userId,
        now,
      );
      if (!session || cursor.position > session._count.items) {
        throw new RecommendationsHttpError(400, "Invalid or expired recommendation cursor");
      }
      if (
        (session.discovery_group_id ?? null) !== (group?.id ?? null) ||
        (session.relationship_intention_filter ?? null) !== (query.relationshipIntention ?? null)
      ) {
        throw new RecommendationsHttpError(400, "Cursor does not match the requested recommendation feed");
      }
      return this.readSnapshotPage(viewer, session, cursor.position, query.limit, now);
    }

    await this.recommendationsRepo.deleteExpiredSessions(now);
    const candidates = await this.recommendationsRepo.findCandidates({
      viewer,
      now,
      discoveryGroupId: group?.id ?? null,
      relationshipIntention: query.relationshipIntention ?? null,
    });
    const viewerPerson = toRecommendationPerson(viewer);
    const scored = candidates
      .filter((candidate) =>
        isMutuallyEligible(viewerPerson, toRecommendationPerson(candidate), now),
      )
      .map((candidate) => {
        const result = scoreRecommendationPair(
          toScoringPerson(viewer),
          toScoringPerson(candidate),
          now,
        );
        return { candidate, ...result };
      })
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (left.candidate.user_id < right.candidate.user_id) return -1;
        if (left.candidate.user_id > right.candidate.user_id) return 1;
        return 0;
      });

    if (!scored.length) {
      return {
        data: [],
        pagination: { limit: query.limit, sessionId: null, nextCursor: null },
      };
    }

    const session = await this.recommendationsRepo.createRankingSession(
      userId,
      RANKING_VERSION,
      new Date(now.getTime() + SESSION_TTL_MS),
      scored.map(({ candidate, score, missingFeatures }) => ({
        candidateUserId: candidate.user_id,
        score,
        missingFeatures,
      })),
      {
        discoveryGroupId: group?.id ?? null,
        relationshipIntention: query.relationshipIntention ?? null,
      },
    );
    const page = scored
      .slice(0, query.limit)
      .map(({ candidate }) => toPublicCandidate(candidate, viewer));
    const nextPosition = page.length;

    return {
      data: page,
      pagination: {
        limit: query.limit,
        sessionId: session.id,
        nextCursor:
          nextPosition < scored.length ? encodeCursor(session.id, nextPosition) : null,
      },
    };
  }

  async recordImpressions(
    userId: string,
    input: { sessionId: string; candidateUserIds: string[] },
  ) {
    const result = await this.recommendationsRepo.recordImpressions(
      userId,
      input.sessionId,
      input.candidateUserIds,
      this.clock(),
    );
    if (!result) {
      throw new RecommendationsHttpError(404, "Recommendation session not found or expired");
    }
    return result;
  }

  private async requireActiveViewer(userId: string): Promise<RecommendationViewerContext> {
    const user = await this.recommendationsRepo.findDiscoveryContext(userId);
    if (!user || user.status !== "active") {
      throw new RecommendationsHttpError(404, "Active user not found");
    }
    if (!user.profiles) {
      throw new RecommendationsHttpError(400, "Create a profile before using discovery");
    }
    return user;
  }

  private async readSnapshotPage(
    viewer: RecommendationViewerContext,
    session: {
      id: string;
      discovery_group_id: string | null;
      relationship_intention_filter: string | null;
      ranking_version: string;
      expires_at: Date;
      _count: { items: number };
    },
    startPosition: number,
    limit: number,
    now: Date,
  ) {
    const data: RecommendationCandidate[] = [];
    let nextPosition = startPosition;
    const batchSize = Math.min(100, Math.max(20, limit * 2));

    while (data.length < limit && nextPosition < session._count.items) {
      const items = await this.recommendationsRepo.findSessionItems(
        session.id,
        nextPosition,
        batchSize,
      );
      if (!items.length) {
        nextPosition = session._count.items;
        break;
      }

      const eligible = await this.recommendationsRepo.findCandidates({
        viewer,
        now,
        candidateUserIds: items.map((item) => item.candidate_user_id),
        discoveryGroupId: session.discovery_group_id,
        relationshipIntention: session.relationship_intention_filter,
      });
      const eligibleByUserId = new Map(eligible.map((candidate) => [candidate.user_id, candidate]));
      const viewerPerson = toRecommendationPerson(viewer);

      for (const item of items) {
        nextPosition = item.position + 1;
        const candidate = eligibleByUserId.get(item.candidate_user_id);
        if (
          candidate &&
          isMutuallyEligible(viewerPerson, toRecommendationPerson(candidate), now)
        ) {
          data.push(candidate);
        }
        if (data.length >= limit) break;
      }
    }

    return {
      data: data.map((candidate) => toPublicCandidate(candidate, viewer)),
      pagination: {
        limit,
        sessionId: session.id,
        nextCursor:
          nextPosition < session._count.items
            ? encodeCursor(session.id, nextPosition)
            : null,
      },
    };
  }
}

function getRecommendationFeedCacheKey(
  userId: string,
  query: RecommendationQuery,
): string {
  const queryHash = createHash("sha256")
    .update(JSON.stringify({
      limit: query.limit,
      cursor: query.cursor ?? null,
      groupSlug: query.groupSlug ?? null,
      relationshipIntention: query.relationshipIntention ?? null,
    }))
    .digest("hex");

  return `recommendations:feed:v1:${userId}:${queryHash}`;
}

export function invalidateUserRecommendationsCache(userId: string): Promise<void> {
  return cacheService.delByPattern(`recommendations:*:${userId}:*`);
}

function toPublicCandidate(
  candidate: RecommendationCandidate,
  viewer: RecommendationViewerContext,
) {
  const { latitude: _latitude, longitude: _longitude, users, ...profile } = candidate;
  const viewerCoordinates = coordinatesOf(
    viewer.profiles!.latitude,
    viewer.profiles!.longitude,
  );
  const candidateCoordinates = coordinatesOf(candidate.latitude, candidate.longitude);
  const distanceKm =
    viewerCoordinates && candidateCoordinates
      ? Math.round(
          haversineKm(
            viewerCoordinates.latitude,
            viewerCoordinates.longitude,
            candidateCoordinates.latitude,
            candidateCoordinates.longitude,
          ) * 10,
        ) / 10
      : null;

  return {
    ...profile,
    distance_km: distanceKm,
    users: {
      id: users.id,
      photos: users.photos,
    },
  };
}

function decodeCursor(value: string): { sessionId: string; position: number } {
  const [sessionId, rawPosition, ...extra] = value.split(CURSOR_SEPARATOR);
  const position = Number(rawPosition);
  if (
    extra.length ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId) ||
    !Number.isSafeInteger(position) ||
    position < 0
  ) {
    throw new RecommendationsHttpError(400, "Invalid recommendation cursor");
  }
  return { sessionId, position };
}

function encodeCursor(sessionId: string, position: number) {
  return `${sessionId}${CURSOR_SEPARATOR}${position}`;
}

function coordinatesOf(latitude: { toNumber(): number } | number | null, longitude: { toNumber(): number } | number | null) {
  const lat = latitude === null ? null : typeof latitude === "number" ? latitude : latitude.toNumber();
  const lng = longitude === null ? null : typeof longitude === "number" ? longitude : longitude.toNumber();
  return lat !== null && lng !== null && validCoordinates(lat, lng)
    ? { latitude: lat, longitude: lng }
    : null;
}

function toRecommendationPerson(
  value: RecommendationViewerContext | RecommendationCandidate,
): RecommendationPerson {
  const isViewer = "profiles" in value;
  const profile = isViewer ? value.profiles : value;
  const user = isViewer ? value : value.users;
  const preferences = preferencesOrDefault(user.preferences);
  return {
    user_id: isViewer ? value.id : value.user_id,
    status: user.status,
    gender: profile!.gender,
    birth_date: profile!.birth_date,
    latitude:
      profile!.latitude === null ? null : Number(profile!.latitude),
    longitude:
      profile!.longitude === null ? null : Number(profile!.longitude),
    preferences,
  };
}

function toScoringPerson(
  value: RecommendationViewerContext | RecommendationCandidate,
): ScoringPerson {
  const isViewer = "profiles" in value;
  const profile = isViewer ? value.profiles! : value;
  const user = isViewer ? value : value.users;
  return {
    hobbies: profile.hobbies,
    languages: profile.languages,
    coordinates: coordinatesOf(profile.latitude, profile.longitude),
    lastActiveAt: user.last_active_at,
    bio: profile.bio,
    jobTitle: profile.job_title,
    city: profile.city,
    ward: profile.ward,
    photoCount: isViewer ? value.photos.length : value.users.photos.length,
    preferences: user.preferences
      ? {
          max_distance_km: user.preferences.max_distance_km,
          interested_languages: user.preferences.interested_languages,
        }
      : null,
  };
}
