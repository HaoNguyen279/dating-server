import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const testDatabaseUrl = process.env.RECOMMENDATION_TEST_DATABASE_URL;

test(
  "PostgreSQL candidate retrieval, snapshot paging, and idempotent impressions",
  { skip: !testDatabaseUrl },
  async (t) => {
    if (!testDatabaseUrl) return;
    const databaseName = new URL(testDatabaseUrl).pathname.slice(1);
    if (!/^recommendation_test_[a-f0-9]{12}$/i.test(databaseName)) {
      throw new Error("Integration tests require a disposable recommendation_test_<12 hex> database");
    }

    process.env.DATABASE_URL = testDatabaseUrl;
    const [{ default: prisma }, { RecommendationsRepository }] = await Promise.all([
      import("../../lib/prisma.js"),
      import("./recommendations.repository.js"),
    ]);
    const repository = new RecommendationsRepository();
    const now = new Date("2026-10-29T12:00:00.000Z");
    const userIds = Array.from({ length: 8 }, () => randomUUID());
    const [viewerId, eligibleId, hiddenId, suspendedId, swipedId, matchedId, distantId, wrongAgeId] = userIds;

    const createUser = async (options: {
      id: string;
      gender?: "male" | "female";
      status?: "active" | "suspended";
      latitude?: number;
      longitude?: number;
      birthDate?: Date;
      showMe?: boolean;
    }) => {
      await prisma.users.create({
        data: {
          id: options.id,
          status: options.status ?? "active",
          last_active_at: now,
          profiles: {
            create: {
              display_name: options.id,
              birth_date: options.birthDate ?? new Date("1992-06-01T00:00:00.000Z"),
              gender: options.gender ?? "male",
              bio: null,
              job_title: null,
              life_style: [],
              hobbies: [],
              education: null,
              city: "Ho Chi Minh City",
              ward: "Ward 1",
              latitude: options.latitude ?? 10.78,
              longitude: options.longitude ?? 106.69,
              languages: ["English"],
            },
          },
          preferences: {
            create: {
              interested_in: options.gender === "female" ? "male" : "female",
              age_min: 20,
              age_max: 50,
              max_distance_km: 50,
              show_me: options.showMe ?? true,
              interested_languages: [],
            },
          },
        },
      });
    };

    t.after(async () => {
      await prisma.users.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    });

    await createUser({ id: viewerId, gender: "female", birthDate: new Date("1991-10-29T00:00:00.000Z") });
    await Promise.all([
      createUser({ id: eligibleId }),
      createUser({ id: hiddenId, showMe: false }),
      createUser({ id: suspendedId, status: "suspended" }),
      createUser({ id: swipedId }),
      createUser({ id: matchedId }),
      createUser({ id: distantId, longitude: 108 }),
      createUser({ id: wrongAgeId, birthDate: new Date("1950-01-01T00:00:00.000Z") }),
    ]);
    await prisma.swipes.create({
      data: { swiper_id: viewerId, swiped_id: swipedId, action: "pass" },
    });
    await prisma.matches.create({
      data: { user1_id: viewerId, user2_id: matchedId, status: "active" },
    });

    const viewer = await repository.findDiscoveryContext(viewerId);
    assert.ok(viewer);
    const candidates = await repository.findCandidates({ viewer, now });
    assert.deepEqual(candidates.map((candidate) => candidate.user_id), [eligibleId]);

    const session = await repository.createRankingSession(viewerId, "integration-v1", new Date(now.getTime() + 60_000), [
      { candidateUserId: eligibleId, score: 82.5, missingFeatures: ["languages-no-preference"] },
    ]);
    const ownedSession = await repository.findRankingSession(session.id, viewerId, now);
    assert.equal(ownedSession?._count.items, 1);
    assert.deepEqual(await repository.findSessionItems(session.id, 0, 20), [
      { position: 0, candidate_user_id: eligibleId },
    ]);
    assert.deepEqual(
      await repository.recordImpressions(viewerId, session.id, [eligibleId], now),
      { recorded: 1 },
    );
    assert.deepEqual(
      await repository.recordImpressions(viewerId, session.id, [eligibleId], now),
      { recorded: 0 },
    );
    assert.equal(await repository.recordImpressions(eligibleId, session.id, [eligibleId], now), null);
  },
);
