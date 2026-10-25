import type { interested_type } from "../../generated/prisma/enums.js";
import type { CreatePreferenceInput, ListPreferencesQuery, UpdatePreferenceInput } from "./preferences.validation.js";
import { PreferencesRepository, type PreferenceData, type PreferenceWhere } from "./preferences.repository.js";

export class PreferencesHttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "PreferencesHttpError";
  }
}

export class PreferencesService {
  constructor(private readonly preferencesRepo: PreferencesRepository) {}

  async list(query: ListPreferencesQuery) {
    const page = query.page;
    const limit = query.limit;
    const where: PreferenceWhere = {};
    if (query.interested_in) where.interested_in = query.interested_in as interested_type;
    if (query.show_me !== undefined) where.show_me = query.show_me;

    const [data, total] = await Promise.all([
      this.preferencesRepo.findAll({
        skip: (page - 1) * limit,
        take: limit,
        where,
        sortOrder: query.sortOrder,
      }),
      this.preferencesRepo.count(where),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getByUserId(userId: string) {
    const preference = await this.preferencesRepo.findByUserId(userId);
    if (!preference) throw new PreferencesHttpError(404, `Preferences for user '${userId}' not found`);
    return preference;
  }

  async create(input: CreatePreferenceInput) {
    await this.ensureUserExists(input.user_id);
    const existing = await this.preferencesRepo.findByUserId(input.user_id);
    if (existing) throw new PreferencesHttpError(409, "Preferences already exist for this user");

    this.validateMergedAgeRange(18, 99, input);

    const { user_id, ...data } = input;
    return this.preferencesRepo.create(user_id, data as PreferenceData);
  }

  async upsert(userId: string, input: UpdatePreferenceInput) {
    await this.ensureUserExists(userId);
    const existing = await this.preferencesRepo.findByUserId(userId);
    this.validateMergedAgeRange(existing?.age_min ?? 18, existing?.age_max ?? 99, input);
    return this.preferencesRepo.upsertByUserId(userId, input as PreferenceData);
  }

  async update(userId: string, input: UpdatePreferenceInput) {
    const existing = await this.getByUserId(userId);
    this.validateMergedAgeRange(existing.age_min, existing.age_max, input);
    return this.preferencesRepo.updateByUserId(userId, input as PreferenceData);
  }

  async delete(userId: string) {
    await this.getByUserId(userId);
    await this.preferencesRepo.deleteByUserId(userId);
  }

  private async ensureUserExists(userId: string) {
    if (!(await this.preferencesRepo.userExists(userId))) {
      throw new PreferencesHttpError(404, `User '${userId}' not found`);
    }
  }

  private validateMergedAgeRange(
    currentMin: number | undefined,
    currentMax: number | undefined,
    input: UpdatePreferenceInput,
  ) {
    const min = input.age_min ?? currentMin;
    const max = input.age_max ?? currentMax;
    if (min !== undefined && max !== undefined && max < min) {
      throw new PreferencesHttpError(400, "age_max must be greater than or equal to age_min");
    }
  }
}
