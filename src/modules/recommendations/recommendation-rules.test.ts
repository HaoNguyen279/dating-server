import assert from "node:assert/strict";
import test from "node:test";
import {
  ageOn,
  birthDateRangeForAge,
  coordinateBoundingBox,
  haversineKm,
  isMutuallyEligible,
  type RecommendationPerson,
} from "./recommendation-rules.js";

const now = new Date("2026-10-29T12:00:00.000Z");

function person(overrides: Partial<RecommendationPerson> = {}): RecommendationPerson {
  return {
    user_id: "viewer",
    status: "active",
    gender: "female",
    birth_date: new Date("1991-05-01T00:00:00.000Z"),
    latitude: 10.78,
    longitude: 106.69,
    preferences: {
      interested_in: "male",
      age_min: 18,
      age_max: 50,
      max_distance_km: 50,
      show_me: true,
      interested_languages: [],
    },
    ...overrides,
  };
}

test("age uses the birthday rather than a cached age", () => {
  assert.equal(ageOn(new Date("2000-10-30T00:00:00.000Z"), now), 25);
  assert.equal(ageOn(new Date("2000-10-29T00:00:00.000Z"), now), 26);
});

test("birth date boundaries represent the inclusive age range", () => {
  const bounds = birthDateRangeForAge(25, 30, now);
  assert.equal(bounds.min.toISOString().slice(0, 10), "1995-10-30");
  assert.equal(bounds.max.toISOString().slice(0, 10), "2001-10-29");
});

test("eligibility excludes the viewer, inactive, hidden, swiped, and matched users", () => {
  const viewer = person();
  const candidate = person({ user_id: "candidate", gender: "male" });
  assert.equal(isMutuallyEligible(viewer, viewer, now), false);
  assert.equal(isMutuallyEligible(viewer, person({ user_id: "x", status: "suspended" }), now), false);
  assert.equal(
    isMutuallyEligible(viewer, person({ user_id: "x", preferences: { ...candidate.preferences!, show_me: false } }), now),
    false,
  );
  assert.equal(isMutuallyEligible(viewer, person({ user_id: "x", gender: "male", swipedByViewer: true }), now), false);
  assert.equal(isMutuallyEligible(viewer, person({ user_id: "x", gender: "male", activeMatchWithViewer: true }), now), false);
});

test("age and gender preferences must match in both directions", () => {
  const viewer = person({
    preferences: {
      interested_in: "male",
      age_min: 30,
      age_max: 40,
      max_distance_km: 50,
      show_me: true,
      interested_languages: [],
    },
  });
  const candidate = person({
    user_id: "candidate",
    gender: "male",
    birth_date: new Date("1996-01-01T00:00:00.000Z"),
    preferences: {
      interested_in: "female",
      age_min: 30,
      age_max: 40,
      max_distance_km: 50,
      show_me: true,
      interested_languages: [],
    },
  });
  assert.equal(isMutuallyEligible(viewer, candidate, now), true);
  assert.equal(
    isMutuallyEligible(viewer, { ...candidate, preferences: { ...candidate.preferences!, interested_in: "male" } }, now),
    false,
  );
  assert.equal(
    isMutuallyEligible(viewer, { ...candidate, birth_date: new Date("2005-01-01T00:00:00.000Z") }, now),
    false,
  );
});

test("distance must fit both users' hard distance preferences", () => {
  const viewer = person({
    preferences: {
      interested_in: "male",
      age_min: 18,
      age_max: 50,
      max_distance_km: 10,
      show_me: true,
      interested_languages: [],
    },
  });
  const nearby = person({
    user_id: "nearby",
    gender: "male",
    latitude: 10.78,
    longitude: 106.80,
    preferences: {
      interested_in: "female",
      age_min: 18,
      age_max: 50,
      max_distance_km: 50,
      show_me: true,
      interested_languages: [],
    },
  });
  assert.equal(isMutuallyEligible(viewer, nearby, now), false);
  assert.equal(
    isMutuallyEligible(
      { ...viewer, preferences: { ...viewer.preferences!, max_distance_km: 20 } },
      { ...nearby, preferences: { ...nearby.preferences!, max_distance_km: 20 } },
      now,
    ),
    true,
  );
});

test("missing or invalid coordinates fail closed for distance eligibility", () => {
  const viewer = person();
  assert.equal(isMutuallyEligible(viewer, person({ user_id: "unknown", gender: "male", latitude: null }), now), false);
  assert.equal(isMutuallyEligible({ ...viewer, longitude: null }, person({ user_id: "x", gender: "male" }), now), false);
  assert.equal(isMutuallyEligible({ ...viewer, latitude: 95 }, person({ user_id: "x", gender: "male" }), now), false);
});

test("haversine and longitude wrapping handle real locations and the date line", () => {
  assert.ok(haversineKm(10.78, 106.69, 10.78, 106.69) < 0.001);
  assert.ok(haversineKm(0, 0, 0, 1) > 111 && haversineKm(0, 0, 0, 1) < 112);
  const box = coordinateBoundingBox(0, 179.9, 50);
  assert.ok(box.longitudeRanges && box.longitudeRanges.length === 2);
});
