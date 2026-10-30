import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "../../generated/prisma/client.js";
import type {
  RecommendationCandidate,
  RecommendationViewerContext,
} from "./recommendations.repository.js";
import { RecommendationsService, RecommendationsHttpError } from "./recommendations.service.js";

const now = new Date("2026-10-29T12:00:00.000Z");
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function viewerContext(
  overrides: Partial<RecommendationViewerContext> = {},
): RecommendationViewerContext {
  return {
    id: "viewer-user",
    status: "active",
    last_active_at: new Date("2026-10-29T10:00:00.000Z"),
    profiles: {
      user_id: "viewer-user",
      gender: "female",
      birth_date: new Date("1991-05-01T00:00:00.000Z"),
      hobbies: [{ id: "reading", name: "Reading", category: "Arts & Culture" }],
      languages: ["English"],
      latitude: 10.78,
      longitude: 106.69,
      bio: "Viewer bio",
      job_title: "Designer",
      city: "Hà Nội",
      ward: "Xã Example",
    },
    preferences: {
      interested_in: "male",
      age_min: 18,
      age_max: 50,
      max_distance_km: 50,
      show_me: true,
      interested_languages: ["English"],
    },
    photos: [{ id: "viewer-photo" }],
    ...overrides,
  } as RecommendationViewerContext;
}

function candidate(userId: string, overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    id: `profile-${userId}`,
    user_id: userId,
    display_name: userId,
    birth_date: new Date("1995-01-01T00:00:00.000Z"),
    gender: "male",
    bio: "Candidate bio",
    job_title: "Artist",
    pet: null,
    life_style: [],
    hobbies: [{ id: "reading", name: "Reading", category: "Arts & Culture" }],
    education: null,
    height_cm: null,
    city: "Hà Nội",
    ward: "Xã Example",
    latitude: 10.78,
    longitude: 106.69,
    is_verified: false,
    languages: ["English"],
    users: {
      id: userId,
      status: "active",
      last_active_at: new Date("2026-10-29T10:00:00.000Z"),
      preferences: null,
      photos: [{ id: `photo-${userId}`, url: "https://example.test/photo.jpg", position: 0, is_primary: true }],
    },
    ...overrides,
  } as RecommendationCandidate;
}

class FakeRecommendationsRepository {
  viewer = viewerContext();
  candidates: RecommendationCandidate[] = [];
  eligibleUserIds = new Set<string>();
  sessionOwner: string | null = null;
  snapshot: Array<{ candidateUserId: string; score: number; missingFeatures: string[] }> = [];
  impressions = new Set<string>();

  async findDiscoveryContext() {
    return this.viewer;
  }

  async deleteExpiredSessions() {}

  async findCandidates(options: { candidateUserIds?: string[] }) {
    return this.candidates.filter(
      (item) =>
        this.eligibleUserIds.has(item.user_id) &&
        (!options.candidateUserIds || options.candidateUserIds.includes(item.user_id)),
    );
  }

  async createRankingSession(userId: string, _version: string, _expiry: Date, items: typeof this.snapshot) {
    this.sessionOwner = userId;
    this.snapshot = items;
    return { id: sessionId };
  }

  async findRankingSession(id: string, userId: string) {
    if (id !== sessionId || this.sessionOwner !== userId) return null;
    return {
      id,
      ranking_version: "rule-v1",
      expires_at: new Date(now.getTime() + 86_400_000),
      _count: { items: this.snapshot.length },
    };
  }

  async findSessionItems(_id: string, startPosition: number, take: number) {
    return this.snapshot
      .slice(startPosition, startPosition + take)
      .map((item, index) => ({
        position: startPosition + index,
        candidate_user_id: item.candidateUserId,
      }));
  }

  async recordImpressions(userId: string, id: string, candidateUserIds: string[]) {
    if (this.sessionOwner !== userId || id !== sessionId) return null;
    const ids = new Set(this.snapshot.map((item) => item.candidateUserId));
    let recorded = 0;
    for (const candidateUserId of candidateUserIds) {
      const key = `${id}:${candidateUserId}`;
      if (ids.has(candidateUserId) && !this.impressions.has(key)) {
        this.impressions.add(key);
        recorded++;
      }
    }
    return { recorded };
  }
}

function serviceFor(repository: FakeRecommendationsRepository) {
  return new RecommendationsService(repository as never, () => new Date(now));
}

test("ranked results sort by score then a stable user ID tie-breaker", async () => {
  const repo = new FakeRecommendationsRepository();
  repo.candidates = [candidate("candidate-z"), candidate("candidate-a")];
  repo.eligibleUserIds = new Set(repo.candidates.map((item) => item.user_id));
  const result = await serviceFor(repo).getRecommendations("viewer-user", { limit: 10 });
  assert.deepEqual(result.data.map((item) => item.user_id), ["candidate-a", "candidate-z"]);
  assert.equal(result.pagination.nextCursor, null);
  assert.equal(result.pagination.sessionId, sessionId);
  assert.equal("score" in result.data[0], false);
  assert.equal("latitude" in result.data[0], false);
  assert.equal("longitude" in result.data[0], false);
  assert.equal(result.data[0].distance_km, 0);
  assert.deepEqual(Object.keys(result.data[0].users ?? {}).sort(), ["id", "photos"]);
});

test("recommendation response includes rounded distance in kilometers", async () => {
  const repo = new FakeRecommendationsRepository();
  repo.candidates = [candidate("candidate-nearby", { latitude: new Prisma.Decimal(10.79) })];
  repo.eligibleUserIds = new Set(["candidate-nearby"]);

  const result = await serviceFor(repo).getRecommendations("viewer-user", { limit: 10 });
  assert.equal(result.data[0].distance_km, 1.1);
});

test("snapshot pagination skips candidates that become ineligible and never repeats a profile", async () => {
  const repo = new FakeRecommendationsRepository();
  repo.candidates = [candidate("candidate-a"), candidate("candidate-b"), candidate("candidate-c")];
  repo.eligibleUserIds = new Set(repo.candidates.map((item) => item.user_id));
  const service = serviceFor(repo);

  const first = await service.getRecommendations("viewer-user", { limit: 1 });
  assert.deepEqual(first.data.map((item) => item.user_id), ["candidate-a"]);
  assert.equal(first.pagination.nextCursor, `${sessionId}:1`);

  repo.eligibleUserIds.delete("candidate-b");
  const second = await service.getRecommendations("viewer-user", {
    limit: 1,
    cursor: first.pagination.nextCursor!,
  });
  assert.deepEqual(second.data.map((item) => item.user_id), ["candidate-c"]);
  assert.equal(second.pagination.nextCursor, null);
  assert.equal([...first.data, ...second.data].filter((item) => item.user_id === "candidate-a").length, 1);
});

test("no eligible candidates returns a valid empty page without a session", async () => {
  const repo = new FakeRecommendationsRepository();
  const result = await serviceFor(repo).getRecommendations("viewer-user", { limit: 20 });
  assert.deepEqual(result.data, []);
  assert.equal(result.pagination.sessionId, null);
  assert.equal(result.pagination.nextCursor, null);
});

test("inactive viewers and viewers without a profile fail using existing service errors", async () => {
  const inactive = new FakeRecommendationsRepository();
  inactive.viewer = viewerContext({ status: "suspended" });
  await assert.rejects(
    serviceFor(inactive).getRecommendations("viewer-user", { limit: 20 }),
    (error: unknown) => error instanceof RecommendationsHttpError && error.statusCode === 404,
  );

  const noProfile = new FakeRecommendationsRepository();
  noProfile.viewer = viewerContext({ profiles: null });
  await assert.rejects(
    serviceFor(noProfile).getRecommendations("viewer-user", { limit: 20 }),
    (error: unknown) => error instanceof RecommendationsHttpError && error.statusCode === 400,
  );
});

test("cursor is bound to a session and its owner", async () => {
  const repo = new FakeRecommendationsRepository();
  repo.sessionOwner = "someone-else";
  await assert.rejects(
    serviceFor(repo).getRecommendations("viewer-user", {
      limit: 20,
      cursor: `${sessionId}:0`,
    }),
    (error: unknown) => error instanceof RecommendationsHttpError && error.statusCode === 400,
  );
});

test("impression writes are idempotent and reject sessions owned by another user", async () => {
  const repo = new FakeRecommendationsRepository();
  repo.candidates = [candidate("candidate-a")];
  repo.eligibleUserIds = new Set(["candidate-a"]);
  const service = serviceFor(repo);
  await service.getRecommendations("viewer-user", { limit: 10 });

  assert.deepEqual(
    await service.recordImpressions("viewer-user", { sessionId, candidateUserIds: ["candidate-a"] }),
    { recorded: 1 },
  );
  assert.deepEqual(
    await service.recordImpressions("viewer-user", { sessionId, candidateUserIds: ["candidate-a"] }),
    { recorded: 0 },
  );
  await assert.rejects(
    service.recordImpressions("another-user", { sessionId, candidateUserIds: ["candidate-a"] }),
    (error: unknown) => error instanceof RecommendationsHttpError && error.statusCode === 404,
  );
});
