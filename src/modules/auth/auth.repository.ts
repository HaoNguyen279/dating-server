import prisma from "../../lib/prisma.js";

const authUserSelect = {
  id: true,
  email: true,
  phone: true,
  status: true,
  last_active_at: true,
  created_at: true,
  updated_at: true,
} as const;

export class AuthRepository {
  async findByEmail(email: string) {
    return prisma.users.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: authUserSelect,
    });
  }

  async findByPhone(phone: string) {
    return prisma.users.findUnique({
      where: { phone },
      select: authUserSelect,
    });
  }

  async findPasswordUserByEmail(email: string) {
    return prisma.users.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { ...authUserSelect, password_hash: true },
    });
  }

  async findPasswordUserByPhone(phone: string) {
    return prisma.users.findUnique({
      where: { phone },
      select: { ...authUserSelect, password_hash: true },
    });
  }

  async createPasswordUser(email: string | null, phone: string | null, passwordHash: string) {
    return prisma.users.create({
      data: { email, phone, password_hash: passwordHash, last_active_at: new Date() },
      select: authUserSelect,
    });
  }

  async findByGoogleSub(googleSub: string) {
    return prisma.users.findUnique({
      where: { google_sub: googleSub },
      select: authUserSelect,
    });
  }

  async createGoogleUser(googleSub: string, email: string | null) {
    return prisma.users.create({
      data: {
        google_sub: googleSub,
        email,
        last_active_at: new Date(),
      },
      select: authUserSelect,
    });
  }

  async recordSignIn(id: string) {
    return prisma.users.update({
      where: { id },
      data: {
        last_active_at: new Date(),
        updated_at: new Date(),
      },
      select: authUserSelect,
    });
  }

  async findByFirebaseUid(firebaseUid: string) {
    return prisma.users.findUnique({
      where: { firebase_uid: firebaseUid },
      select: authUserSelect,
    });
  }

  async createFirebaseUser(firebaseUid: string, email: string | null) {
    return prisma.users.create({
      data: {
        firebase_uid: firebaseUid,
        email,
        last_active_at: new Date(),
      },
      select: authUserSelect,
    });
  }

  async linkFirebaseToExisting(id: string, firebaseUid: string) {
    return prisma.users.update({
      where: { id },
      data: {
        firebase_uid: firebaseUid,
        updated_at: new Date(),
      },
      select: authUserSelect,
    });
  }
}
