import { haversineKm } from "./recommendation-rules.js";

export const RANKING_VERSION = "rule-v1";
export const MISSING_FEATURE_SCORE = 50;

export const RANKING_WEIGHTS = {
  hobbies: 0.35,
  distance: 0.25,
  languages: 0.15,
  activity: 0.15,
  profileCompleteness: 0.1,
} as const;

const KNOWN_HOBBY_IDS = new Set(
  "reading writing poetry painting drawing photography music singing playing_instruments dancing acting crafts fashion interior_design movies tv_shows anime manga gaming board_games puzzles comedy podcasts concerts theater travel road_trips hiking camping backpacking beach nature stargazing cycling running gym yoga pilates swimming badminton basketball football soccer tennis martial_arts climbing skateboarding cooking baking coffee tea foodie wine_tasting mixology gardening plants diy pets volunteering environment learning languages programming technology science astronomy investing entrepreneurship meditation mindfulness journaling fashion_shopping thrifting socializing nightlife museums history cars motorcycles fishing birdwatching sailing snowboarding skiing surfing makeup collecting comics esports content_creation blogging standup_comedy karaoke picnics dancing_salsa food_travel".split(
    " ",
  ),
);

export interface ScoringPerson {
  hobbies: unknown;
  languages: string[];
  coordinates: { latitude: number; longitude: number } | null;
  lastActiveAt: Date | null;
  bio: string | null;
  jobTitle: string | null;
  city: string | null;
  ward: string | null;
  photoCount: number;
  preferences: {
    max_distance_km: number;
    interested_languages: string[];
  } | null;
}

export interface RecommendationFeatures {
  hobbies: number;
  distance: number;
  languages: number;
  activity: number;
  profileCompleteness: number;
}

export interface RecommendationScore {
  score: number;
  features: RecommendationFeatures;
  missingFeatures: string[];
}

function knownHobbyIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) return new Set();
  const ids = value
    .map((item) => {
      if (!item || typeof item !== "object" || !("id" in item)) return null;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string") return null;
      const normalized = id.trim();
      return KNOWN_HOBBY_IDS.has(normalized) ? normalized : null;
    })
    .filter((id): id is string => id !== null);
  return new Set(ids);
}

function normalizedStrings(value: string[]): Set<string> {
  return new Set(value.map((item) => item.trim().toLowerCase()).filter(Boolean));
}

function hobbySimilarity(leftValue: unknown, rightValue: unknown) {
  const left = knownHobbyIds(leftValue);
  const right = knownHobbyIds(rightValue);
  if (left.size === 0 || right.size === 0) return null;
  let intersection = 0;
  for (const id of left) if (right.has(id)) intersection++;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? null : (intersection / union) * 100;
}

function directionalLanguageScore(preferred: string[], spoken: string[]) {
  const preferences = normalizedStrings(preferred);
  const languages = normalizedStrings(spoken);
  const reasons: string[] = [];
  if (preferences.size === 0) reasons.push("no-preference");
  if (languages.size === 0) reasons.push("missing-profile-languages");
  if (reasons.length) return { score: null, reasons };
  let shared = 0;
  for (const language of preferences) if (languages.has(language)) shared++;
  return { score: (shared / preferences.size) * 100, reasons };
}

function languageCompatibility(viewer: ScoringPerson, candidate: ScoringPerson) {
  const viewerPreferences = viewer.preferences?.interested_languages ?? [];
  const candidatePreferences = candidate.preferences?.interested_languages ?? [];
  const directions = [
    directionalLanguageScore(viewerPreferences, candidate.languages),
    directionalLanguageScore(candidatePreferences, viewer.languages),
  ];
  const scores = directions.flatMap((direction) =>
    direction.score === null ? [] : [direction.score],
  );
  const reasons = directions.flatMap((direction) => direction.reasons);
  return {
    score: scores.length ? scores.reduce((total, value) => total + value, 0) / scores.length : null,
    reasons,
  };
}

function activityScore(lastActiveAt: Date | null, now: Date) {
  if (!lastActiveAt || Number.isNaN(lastActiveAt.getTime())) return null;
  const hours = Math.max(0, (now.getTime() - lastActiveAt.getTime()) / 3_600_000);
  if (hours <= 24) return 100;
  if (hours <= 72) return 80;
  if (hours <= 168) return 60;
  if (hours <= 720) return 30;
  return 0;
}

function completenessScore(person: ScoringPerson) {
  const fields = [
    Boolean(person.bio?.trim()),
    Boolean(person.jobTitle?.trim()),
    Boolean(person.city?.trim() || person.ward?.trim()),
    person.photoCount > 0,
  ];
  return (fields.filter(Boolean).length / fields.length) * 100;
}

export function scoreRecommendationPair(
  viewer: ScoringPerson,
  candidate: ScoringPerson,
  now: Date,
): RecommendationScore {
  const missingFeatures: string[] = [];

  const hobbies = hobbySimilarity(viewer.hobbies, candidate.hobbies);
  if (hobbies === null) missingFeatures.push("hobbies");

  let distance: number | null = null;
  if (
    viewer.coordinates &&
    candidate.coordinates &&
    Number.isFinite(viewer.coordinates.latitude) &&
    Number.isFinite(viewer.coordinates.longitude) &&
    Number.isFinite(candidate.coordinates.latitude) &&
    Number.isFinite(candidate.coordinates.longitude)
  ) {
    const km = haversineKm(
      viewer.coordinates.latitude,
      viewer.coordinates.longitude,
      candidate.coordinates.latitude,
      candidate.coordinates.longitude,
    );
    const radius = Math.min(
      viewer.preferences?.max_distance_km ?? 50,
      candidate.preferences?.max_distance_km ?? 50,
    );
    if (Number.isFinite(km) && Number.isFinite(radius)) {
      distance = Math.max(0, Math.min(100, (1 - km / Math.max(1, radius)) * 100));
    } else {
      missingFeatures.push("distance");
    }
  } else {
    missingFeatures.push("distance");
  }

  const language = languageCompatibility(viewer, candidate);
  if (language.reasons.includes("missing-profile-languages")) {
    missingFeatures.push("languages-profile-data");
  }
  if (language.reasons.includes("no-preference")) {
    missingFeatures.push("languages-no-preference");
  }
  const activity = activityScore(candidate.lastActiveAt, now);
  if (activity === null) missingFeatures.push("activity");

  const features: RecommendationFeatures = {
    hobbies: hobbies ?? MISSING_FEATURE_SCORE,
    distance: distance ?? MISSING_FEATURE_SCORE,
    languages: language.score ?? MISSING_FEATURE_SCORE,
    activity: activity ?? MISSING_FEATURE_SCORE,
    profileCompleteness: completenessScore(candidate),
  };

  const score =
    features.hobbies * RANKING_WEIGHTS.hobbies +
    features.distance * RANKING_WEIGHTS.distance +
    features.languages * RANKING_WEIGHTS.languages +
    features.activity * RANKING_WEIGHTS.activity +
    features.profileCompleteness * RANKING_WEIGHTS.profileCompleteness;

  return {
    score: Math.round(score * 100) / 100,
    features,
    missingFeatures,
  };
}
