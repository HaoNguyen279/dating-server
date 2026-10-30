import assert from "node:assert/strict";
import test from "node:test";
import {
  MISSING_FEATURE_SCORE,
  RANKING_WEIGHTS,
  scoreRecommendationPair,
  type ScoringPerson,
} from "./recommendation-scoring.js";

const now = new Date("2026-10-29T12:00:00.000Z");

function scoringPerson(overrides: Partial<ScoringPerson> = {}): ScoringPerson {
  return {
    hobbies: [{ id: "reading", name: "Reading", category: "Arts & Culture" }],
    languages: ["English"],
    coordinates: { latitude: 10.78, longitude: 106.69 },
    lastActiveAt: new Date("2026-10-29T06:00:00.000Z"),
    bio: "A bio",
    jobTitle: "Designer",
    city: "Hà Nội",
    ward: "Xã Example",
    photoCount: 1,
    preferences: { max_distance_km: 50, interested_languages: ["English"] },
    ...overrides,
  };
}

test("configured feature weights total 100 percent", () => {
  assert.equal(Object.values(RANKING_WEIGHTS).reduce((sum, weight) => sum + weight, 0), 1);
});

test("hobby score is Jaccard over known IDs, deduplicates IDs, and ignores unknown IDs", () => {
  const viewer = scoringPerson({
    hobbies: [
      { id: "reading", name: "Reading", category: "Arts & Culture" },
      { id: "reading", name: "Duplicate", category: "Other" },
      { id: "made_up", name: "Unknown", category: "Other" },
      { id: "writing", name: "Writing", category: "Arts & Culture" },
    ],
  });
  const candidate = scoringPerson({
    hobbies: [{ id: "reading", name: "Reading", category: "Arts & Culture" }],
  });
  assert.equal(scoreRecommendationPair(viewer, candidate, now).features.hobbies, 50);
});

test("no shared declared hobbies scores zero, while absent hobby data uses the neutral score", () => {
  const viewer = scoringPerson({ hobbies: [{ id: "reading", name: "Reading", category: "Arts" }] });
  const disjoint = scoringPerson({ hobbies: [{ id: "writing", name: "Writing", category: "Arts" }] });
  const missing = scoringPerson({ hobbies: [] });
  assert.equal(scoreRecommendationPair(viewer, disjoint, now).features.hobbies, 0);
  const missingResult = scoreRecommendationPair(viewer, missing, now);
  assert.equal(missingResult.features.hobbies, MISSING_FEATURE_SCORE);
  assert.ok(missingResult.missingFeatures.includes("hobbies"));
});

test("distance score decreases as distance grows and is not a match probability", () => {
  const viewer = scoringPerson();
  const near = scoringPerson({ coordinates: { latitude: 10.78, longitude: 106.70 } });
  const far = scoringPerson({ coordinates: { latitude: 10.78, longitude: 107.0 } });
  const nearScore = scoreRecommendationPair(viewer, near, now).features.distance;
  const farScore = scoreRecommendationPair(viewer, far, now).features.distance;
  assert.ok(nearScore > farScore);
  assert.ok(nearScore >= 0 && nearScore <= 100);
});

test("language scoring uses declared preferences against languages spoken", () => {
  const viewer = scoringPerson({
    languages: ["Vietnamese"],
    preferences: { max_distance_km: 50, interested_languages: ["English", "Vietnamese"] },
  });
  const candidate = scoringPerson({
    languages: ["English"],
    preferences: { max_distance_km: 50, interested_languages: ["English"] },
  });
  assert.equal(scoreRecommendationPair(viewer, candidate, now).features.languages, 25);

  const noOverlap = scoringPerson({
    languages: ["Vietnamese"],
    preferences: { max_distance_km: 50, interested_languages: ["English"] },
  });
  const noOverlapViewer = scoringPerson({
    languages: ["Vietnamese"],
    preferences: { max_distance_km: 50, interested_languages: ["English"] },
  });
  assert.equal(scoreRecommendationPair(noOverlapViewer, noOverlap, now).features.languages, 0);
});

test("missing preferences and missing spoken languages are distinguished and neutral", () => {
  const viewer = scoringPerson({
    languages: [],
    preferences: { max_distance_km: 50, interested_languages: [] },
  });
  const candidate = scoringPerson({
    languages: [],
    preferences: { max_distance_km: 50, interested_languages: [] },
  });
  const result = scoreRecommendationPair(viewer, candidate, now);
  assert.equal(result.features.languages, MISSING_FEATURE_SCORE);
  assert.ok(result.missingFeatures.includes("languages-no-preference"));
  assert.ok(result.missingFeatures.includes("languages-profile-data"));
});

test("activity decays in configured windows and missing activity remains neutral", () => {
  const viewer = scoringPerson();
  const recent = scoringPerson({ lastActiveAt: new Date("2026-10-28T12:00:00.000Z") });
  const stale = scoringPerson({ lastActiveAt: new Date("2026-09-01T12:00:00.000Z") });
  const missing = scoringPerson({ lastActiveAt: null });
  assert.equal(scoreRecommendationPair(viewer, recent, now).features.activity, 100);
  assert.equal(scoreRecommendationPair(viewer, stale, now).features.activity, 0);
  const missingResult = scoreRecommendationPair(viewer, missing, now);
  assert.equal(missingResult.features.activity, MISSING_FEATURE_SCORE);
  assert.ok(missingResult.missingFeatures.includes("activity"));
});

test("profile completeness only uses selected discovery fields", () => {
  const empty = scoringPerson({ bio: null, jobTitle: null, city: null, ward: null, photoCount: 0 });
  const complete = scoringPerson();
  assert.equal(scoreRecommendationPair(empty, empty, now).features.profileCompleteness, 0);
  assert.equal(scoreRecommendationPair(complete, complete, now).features.profileCompleteness, 100);
});

test("missing and invalid features never produce NaN or Infinity", () => {
  const empty = scoringPerson({
    hobbies: null,
    languages: [],
    coordinates: { latitude: Number.NaN, longitude: Number.POSITIVE_INFINITY },
    lastActiveAt: null,
    bio: null,
    jobTitle: null,
    city: null,
    ward: null,
    photoCount: 0,
    preferences: { max_distance_km: 0, interested_languages: [] },
  });
  const result = scoreRecommendationPair(empty, empty, now);
  assert.ok(Number.isFinite(result.score));
  assert.ok(Object.values(result.features).every(Number.isFinite));
  assert.ok(result.missingFeatures.includes("distance"));
});

test("same inputs and ranking version produce the same score", () => {
  const viewer = scoringPerson();
  const candidate = scoringPerson({ coordinates: { latitude: 10.8, longitude: 106.7 } });
  assert.deepEqual(
    scoreRecommendationPair(viewer, candidate, now),
    scoreRecommendationPair(viewer, candidate, now),
  );
});
