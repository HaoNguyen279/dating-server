export type Gender = "male" | "female" | "non_binary" | "other";
export type InterestedIn = "male" | "female" | "everyone";

export interface RecommendationPreferences {
  interested_in: InterestedIn;
  age_min: number;
  age_max: number;
  max_distance_km: number;
  show_me: boolean;
  interested_languages: string[];
}

export interface RecommendationPerson {
  user_id: string;
  status: "active" | "suspended" | "deleted";
  gender: Gender;
  birth_date: Date;
  latitude: number | null;
  longitude: number | null;
  preferences: RecommendationPreferences | null;
  swipedByViewer?: boolean;
  activeMatchWithViewer?: boolean;
}

const DEFAULT_PREFERENCES: RecommendationPreferences = {
  interested_in: "everyone",
  age_min: 18,
  age_max: 99,
  max_distance_km: 50,
  show_me: true,
  interested_languages: [],
};

export function preferencesOrDefault(
  preferences: RecommendationPreferences | null | undefined,
): RecommendationPreferences {
  return preferences ?? DEFAULT_PREFERENCES;
}

export function ageOn(birthDate: Date, now: Date): number {
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth();
  const todayDay = now.getUTCDate();
  let age = todayYear - birthDate.getUTCFullYear();
  if (
    todayMonth < birthDate.getUTCMonth() ||
    (todayMonth === birthDate.getUTCMonth() && todayDay < birthDate.getUTCDate())
  ) {
    age--;
  }
  return age;
}

function shiftUtcYears(date: Date, years: number): Date {
  const year = date.getUTCFullYear() - years;
  const month = date.getUTCMonth();
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day));
}

export function birthDateRangeForAge(minAge: number, maxAge: number, now: Date) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const min = shiftUtcYears(today, maxAge + 1);
  min.setUTCDate(min.getUTCDate() + 1);
  const max = shiftUtcYears(today, minAge);
  return { min, max };
}

export function acceptsGender(preference: InterestedIn, gender: Gender): boolean {
  return preference === "everyone" || preference === gender;
}

export function validCoordinates(
  latitude: number | null,
  longitude: number | null,
): boolean {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function haversineKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(deltaLongitude / 2) ** 2;
  const boundedA = Math.max(0, Math.min(1, a));
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));
}

export function coordinateBoundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number,
) {
  const angularRadius = radiusKm / 6371.0088;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const minLatitudeRadians = Math.max(-Math.PI / 2, latitudeRadians - angularRadius);
  const maxLatitudeRadians = Math.min(Math.PI / 2, latitudeRadians + angularRadius);
  const minLatitude = (minLatitudeRadians * 180) / Math.PI;
  const maxLatitude = (maxLatitudeRadians * 180) / Math.PI;
  const touchesPole = minLatitudeRadians <= -Math.PI / 2 || maxLatitudeRadians >= Math.PI / 2;
  if (touchesPole) {
    return { minLatitude, maxLatitude, longitudeRanges: null };
  }

  const longitudeDeltaRadians = Math.asin(
    Math.sin(angularRadius) / Math.cos(latitudeRadians),
  );
  if (!Number.isFinite(longitudeDeltaRadians) || longitudeDeltaRadians >= Math.PI) {
    return { minLatitude, maxLatitude, longitudeRanges: null };
  }

  const longitudeDelta = (longitudeDeltaRadians * 180) / Math.PI;
  const west = longitude - longitudeDelta;
  const east = longitude + longitudeDelta;
  let longitudeRanges: Array<{ min: number; max: number }>;
  if (west < -180) {
    longitudeRanges = [
      { min: west + 360, max: 180 },
      { min: -180, max: east },
    ];
  } else if (east > 180) {
    longitudeRanges = [
      { min: west, max: 180 },
      { min: -180, max: east - 360 },
    ];
  } else {
    longitudeRanges = [{ min: west, max: east }];
  }
  return { minLatitude, maxLatitude, longitudeRanges };
}

export function isMutuallyEligible(
  viewer: RecommendationPerson,
  candidate: RecommendationPerson,
  now: Date,
): boolean {
  if (viewer.user_id === candidate.user_id) return false;
  if (viewer.status !== "active" || candidate.status !== "active") return false;
  if (candidate.preferences && !candidate.preferences.show_me) return false;
  if (candidate.swipedByViewer || candidate.activeMatchWithViewer) {
    return false;
  }

  const viewerPreferences = preferencesOrDefault(viewer.preferences);
  const candidatePreferences = preferencesOrDefault(candidate.preferences);
  const viewerAge = ageOn(viewer.birth_date, now);
  const candidateAge = ageOn(candidate.birth_date, now);

  if (candidateAge < viewerPreferences.age_min || candidateAge > viewerPreferences.age_max) {
    return false;
  }
  if (viewerAge < candidatePreferences.age_min || viewerAge > candidatePreferences.age_max) {
    return false;
  }
  if (!acceptsGender(viewerPreferences.interested_in, candidate.gender)) return false;
  if (!acceptsGender(candidatePreferences.interested_in, viewer.gender)) return false;

  const viewerLatitude = viewer.latitude;
  const viewerLongitude = viewer.longitude;
  const candidateLatitude = candidate.latitude;
  const candidateLongitude = candidate.longitude;
  if (
    viewerLatitude === null ||
    viewerLongitude === null ||
    candidateLatitude === null ||
    candidateLongitude === null ||
    !validCoordinates(viewerLatitude, viewerLongitude) ||
    !validCoordinates(candidateLatitude, candidateLongitude)
  ) {
    return false;
  }
  const distance = haversineKm(
    viewerLatitude,
    viewerLongitude,
    candidateLatitude,
    candidateLongitude,
  );
  return (
    distance <= viewerPreferences.max_distance_km &&
    distance <= candidatePreferences.max_distance_km
  );
}
