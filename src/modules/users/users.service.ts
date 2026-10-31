import crypto from "node:crypto";
import { UsersRepository, type SafeUser, type FindUsersOptions } from "./users.repository.js";
import type {
  CreateUserInput,
  UpdateUserInput,
  ListUsersQuery,
  CheckAvailabilityQuery,
} from "./users.validation.js";
import type { user_status } from "../../generated/prisma/enums.js";
import { invalidateAuthUserCache } from "../../middlewares/authenticate.js";
import { invalidateUserRecommendationsCache } from "../recommendations/recommendations.service.js";

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Resource not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Resource conflict") {
    super(409, message);
    this.name = "ConflictError";
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request") {
    super(400, message);
    this.name = "BadRequestError";
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, "hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export class UsersService {
  constructor(private readonly usersRepo: UsersRepository) {}

  async createUser(input: CreateUserInput): Promise<SafeUser> {
    const email = input.email ? input.email.trim().toLowerCase() : null;
    const phone = input.phone ? input.phone.trim() : null;

    if (email) {
      const existingEmail = await this.usersRepo.findByEmail(email);
      if (existingEmail) {
        throw new ConflictError("Email is already registered");
      }
    }

    if (phone) {
      const existingPhone = await this.usersRepo.findByPhone(phone);
      if (existingPhone) {
        throw new ConflictError("Phone number is already registered");
      }
    }

    let passwordHash: string | null = null;
    if (input.password) {
      passwordHash = hashPassword(input.password);
    } else if (input.password_hash) {
      passwordHash = input.password_hash;
    }

    return this.usersRepo.create({
      email,
      phone,
      password_hash: passwordHash,
      status: input.status as user_status,
    });
  }

  async getUsers(query: ListUsersQuery) {
    const page = Math.max(1, query.page);
    const limit = Math.min(100, Math.max(1, query.limit));
    const skip = (page - 1) * limit;

    const where: FindUsersOptions["where"] = {};

    if (query.status) {
      where.status = query.status as user_status;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term } },
      ];
    }

    const orderBy = {
      [query.sortBy]: query.sortOrder,
    };

    const [users, total] = await Promise.all([
      this.usersRepo.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        includeProfile: query.includeProfile,
      }),
      this.usersRepo.count(where),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getUserById(id: string, includeRelations = false): Promise<SafeUser> {
    const user = await this.usersRepo.findById(id, includeRelations);
    if (!user) {
      throw new NotFoundError(`User with id '${id}' not found`);
    }
    return user;
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<SafeUser> {
    const existing = await this.getUserById(id);

    const email = input.email !== undefined ? (input.email ? input.email.trim().toLowerCase() : null) : existing.email;
    const phone = input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : existing.phone;

    if (!email && !phone) {
      throw new BadRequestError("User must have at least one contact method (email or phone)");
    }

    if (input.email && input.email.trim().toLowerCase() !== existing.email?.toLowerCase()) {
      const emailTaken = await this.usersRepo.findByEmail(input.email.trim().toLowerCase());
      if (emailTaken && emailTaken.id !== id) {
        throw new ConflictError("Email is already taken by another account");
      }
    }

    if (input.phone && input.phone.trim() !== existing.phone) {
      const phoneTaken = await this.usersRepo.findByPhone(input.phone.trim());
      if (phoneTaken && phoneTaken.id !== id) {
        throw new ConflictError("Phone number is already taken by another account");
      }
    }

    const updateData: {
      email?: string | null;
      phone?: string | null;
      status?: user_status;
      password_hash?: string;
    } = {};

    if (input.email !== undefined) {
      updateData.email = email;
    }

    if (input.phone !== undefined) {
      updateData.phone = phone;
    }

    if (input.status !== undefined) {
      updateData.status = input.status as user_status;
    }

    if (input.password) {
      updateData.password_hash = hashPassword(input.password);
    }

    const user = await this.usersRepo.update(id, updateData);
    await Promise.all([
      invalidateAuthUserCache(),
      invalidateUserRecommendationsCache(id),
    ]);
    return user;
  }

  async updateStatus(id: string, status: user_status): Promise<SafeUser> {
    await this.getUserById(id);
    const user = await this.usersRepo.updateStatus(id, status);
    await Promise.all([
      invalidateAuthUserCache(),
      invalidateUserRecommendationsCache(id),
    ]);
    return user;
  }

  async recordActivity(id: string): Promise<SafeUser> {
    await this.getUserById(id);
    const user = await this.usersRepo.updateLastActive(id);
    await invalidateAuthUserCache();
    return user;
  }

  async deleteUser(id: string, hard = false): Promise<{ message: string; deleted: boolean; type: "soft" | "hard" }> {
    await this.getUserById(id);

    if (hard) {
      await this.usersRepo.hardDelete(id);
      await Promise.all([
        invalidateAuthUserCache(),
        invalidateUserRecommendationsCache(id),
      ]);
      return {
        message: "User permanently deleted",
        deleted: true,
        type: "hard",
      };
    }

    await this.usersRepo.softDelete(id);
    await Promise.all([
      invalidateAuthUserCache(),
      invalidateUserRecommendationsCache(id),
    ]);
    return {
      message: "User successfully deactivated (status set to deleted)",
      deleted: true,
      type: "soft",
    };
  }

  async checkAvailability(query: CheckAvailabilityQuery) {
    const result: { emailAvailable?: boolean; phoneAvailable?: boolean } = {};

    if (query.email) {
      const found = await this.usersRepo.findByEmail(query.email.trim().toLowerCase());
      result.emailAvailable = !found;
    }

    if (query.phone) {
      const found = await this.usersRepo.findByPhone(query.phone.trim());
      result.phoneAvailable = !found;
    }

    return result;
  }
}
