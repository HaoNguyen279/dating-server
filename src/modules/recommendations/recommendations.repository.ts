import prisma from "../../lib/prisma.js";
import type { gender_type, Prisma } from "../../generated/prisma/client.js";
import {
  ageOn,
  birthDateRangeForAge,
  coordinateBoundingBox,
  preferencesOrDefault,
  validCoordinates,
} from "./recommendation-rules.js";

const preferencesSelect = {
  interested_in: true,
  age_min: true,
  age_max: true,
  max_distance_km: true,
  show_me: true,
  interested_languages: true,
} satisfies Prisma.preferencesSelect;

const contextSelect = {
  id: true,
  status: true,
  last_active_at: true,
  profiles: {
    select: {
      user_id: true,
      gender: true,
      birth_date: true,
      hobbies: true,
      languages: true,
      latitude: true,
      longitude: true,
      bio: true,
      job_title: true,
      city: true,
      ward: true,
    },
  },
  preferences: { select: preferencesSelect },
  photos: { select: { id: true } },
} satisfies Prisma.usersSelect;

export type RecommendationViewerContext = Prisma.usersGetPayload<{
  select: typeof contextSelect;
}>;

const candidateSelect = {
  id: true,
  user_id: true,
  display_name: true,
  birth_date: true,
  gender: true,
  relationship_intention: true,
  bio: true,
  job_title: true,
  pet: true,
  life_style: true,
  hobbies: true,
  education: true,
  height_cm: true,
  city: true,
  ward: true,
  latitude: true,
  longitude: true,
  is_verified: true,
  languages: true,
  users: {
    select: {
      id: true,
      status: true,
      last_active_at: true,
      preferences: { select: preferencesSelect },
      photos: {
        orderBy: [{ is_primary: "desc" }, { position: "asc" }],
        select: { id: true, url: true, position: true, is_primary: true },
      },
    },
  },
} satisfies Prisma.profilesSelect;

export type RecommendationCandidate = Prisma.profilesGetPayload<{
  select: typeof candidateSelect;
}>;

export interface RankingSnapshotItemInput {
  candidateUserId: string;
  score: number;
  missingFeatures: string[];
}

export class RecommendationsRepository {
  async findDiscoveryContext(userId: string) {
    return prisma.users.findUnique({ where: { id: userId }, select: contextSelect });
  }

  async findCandidates(options: {
    viewer: RecommendationViewerContext;
    now: Date;
    candidateUserIds?: string[];
    discoveryGroupId?: string | null;
    relationshipIntention?: string | null;
  }): Promise<RecommendationCandidate[]> {
    const viewerProfile = options.viewer.profiles;
    if (!viewerProfile) return [];
    const viewerLatitude = viewerProfile.latitude === null ? null : Number(viewerProfile.latitude);
    const viewerLongitude = viewerProfile.longitude === null ? null : Number(viewerProfile.longitude);
    if (!validCoordinates(viewerLatitude, viewerLongitude)) {
      // max_distance_km is a hard preference; unknown coordinates cannot prove eligibility.
      return [];
    }

    const viewerPreferences = preferencesOrDefault(options.viewer.preferences);
    const viewerAge = ageOn(viewerProfile.birth_date, options.now);
    const birthDates = birthDateRangeForAge(
      viewerPreferences.age_min,
      viewerPreferences.age_max,
      options.now,
    );
    const geoBox = coordinateBoundingBox(
      viewerLatitude!,
      viewerLongitude!,
      viewerPreferences.max_distance_km,
    );

    const candidateUserConditions: Prisma.usersWhereInput[] = [
      { status: "active" },
      {
        swipes_swipes_swiped_idTousers: {
          none: { swiper_id: options.viewer.id },
        },
      },
      {
        matches_matches_user1_idTousers: {
          none: { user2_id: options.viewer.id, status: "active" },
        },
      },
      {
        matches_matches_user2_idTousers: {
          none: { user1_id: options.viewer.id, status: "active" },
        },
      },
      {
        OR: [
          { preferences: { is: null } },
          { preferences: { is: { show_me: true } } },
        ],
      },
      {
        OR: [
          { preferences: { is: null } },
          {
            preferences: {
              is: {
                age_min: { lte: viewerAge },
                age_max: { gte: viewerAge },
              },
            },
          },
        ],
      },
      {
        OR: [
          { preferences: { is: null } },
          { preferences: { is: { interested_in: "everyone" } } },
          ...(viewerProfile.gender === "male" || viewerProfile.gender === "female"
            ? [
                {
                  preferences: {
                    is: { interested_in: viewerProfile.gender },
                  },
                } satisfies Prisma.usersWhereInput,
              ]
            : []),
        ],
      },
      ...(options.discoveryGroupId
        ? [
            {
              discovery_group_members: {
                some: { group_id: options.discoveryGroupId },
              },
            } satisfies Prisma.usersWhereInput,
          ]
        : []),
    ];

    const profileConditions: Prisma.profilesWhereInput[] = [
      { latitude: { gte: geoBox.minLatitude, lte: geoBox.maxLatitude } },
    ];
    if (geoBox.longitudeRanges) {
      profileConditions.push({
        OR: geoBox.longitudeRanges.map((range) => ({
          longitude: { gte: range.min, lte: range.max },
        })),
      });
    }

    return prisma.profiles.findMany({
      where: {
        ...(options.relationshipIntention
          ? { relationship_intention: options.relationshipIntention }
          : {}),
        user_id: {
          not: options.viewer.id,
          ...(options.candidateUserIds ? { in: options.candidateUserIds } : {}),
        },
        birth_date: { gte: birthDates.min, lte: birthDates.max },
        ...(viewerPreferences.interested_in !== "everyone"
          ? { gender: viewerPreferences.interested_in as gender_type }
          : {}),
        users: { is: { AND: candidateUserConditions } },
        AND: profileConditions,
      },
      select: candidateSelect,
    });
  }

  async deleteExpiredSessions(now: Date) {
    return prisma.recommendation_sessions.deleteMany({
      where: { expires_at: { lte: now } },
    });
  }

  async createRankingSession(
    userId: string,
    rankingVersion: string,
    expiresAt: Date,
    items: RankingSnapshotItemInput[],
    scope: {
      discoveryGroupId?: string | null;
      relationshipIntention?: string | null;
    } = {},
  ) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.recommendation_sessions.create({
        data: {
          user_id: userId,
          discovery_group_id: scope.discoveryGroupId ?? null,
          relationship_intention_filter: scope.relationshipIntention ?? null,
          ranking_version: rankingVersion,
          expires_at: expiresAt,
        },
        select: { id: true },
      });
      if (items.length) {
        await tx.recommendation_session_items.createMany({
          data: items.map((item, position) => ({
            session_id: session.id,
            position,
            candidate_user_id: item.candidateUserId,
            ranking_score: item.score,
            missing_features: item.missingFeatures,
          })),
        });
      }
      return session;
    });
  }

  async findRankingSession(sessionId: string, userId: string, now: Date) {
    return prisma.recommendation_sessions.findFirst({
      where: { id: sessionId, user_id: userId, expires_at: { gt: now } },
      select: {
        id: true,
        discovery_group_id: true,
        relationship_intention_filter: true,
        ranking_version: true,
        expires_at: true,
        _count: { select: { items: true } },
      },
    });
  }

  findActiveGroupBySlug(slug: string) {
    return prisma.discovery_groups.findFirst({
      where: { slug, is_active: true },
      select: { id: true, slug: true, name: true },
    });
  }

  async findSessionItems(sessionId: string, startPosition: number, take: number) {
    return prisma.recommendation_session_items.findMany({
      where: { session_id: sessionId, position: { gte: startPosition } },
      orderBy: { position: "asc" },
      take,
      select: { position: true, candidate_user_id: true },
    });
  }

  async recordImpressions(userId: string, sessionId: string, candidateUserIds: string[], now: Date) {
    const session = await prisma.recommendation_sessions.findFirst({
      where: { id: sessionId, user_id: userId, expires_at: { gt: now } },
      select: { id: true },
    });
    if (!session) return null;

    const items = await prisma.recommendation_session_items.findMany({
      where: {
        session_id: sessionId,
        candidate_user_id: { in: [...new Set(candidateUserIds)] },
      },
      select: { session_id: true, candidate_user_id: true, position: true },
    });
    if (!items.length) return { recorded: 0 };

    const result = await prisma.recommendation_impressions.createMany({
      data: items.map((item) => ({ ...item, viewed_at: now })),
      skipDuplicates: true,
    });
    return { recorded: result.count };
  }
}
