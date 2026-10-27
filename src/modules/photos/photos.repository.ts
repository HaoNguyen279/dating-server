import prisma from "../../lib/prisma.js";

export class PhotosRepository {
  async getNextPosition(userId: string) {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) return null;

    const latestPhoto = await prisma.photos.findFirst({
      where: { user_id: userId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    return (latestPhoto?.position ?? -1) + 1;
  }

  async createForUser(userId: string, url: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) return null;

      const latestPhoto = await tx.photos.findFirst({
        where: { user_id: userId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (latestPhoto?.position ?? -1) + 1;

      if (position > 8) {
        throw new PhotoLimitError();
      }

      return tx.photos.create({
        data: {
          user_id: userId,
          url,
          position,
          is_primary: position === 0,
        },
      });
    });
  }
}

export class PhotoLimitError extends Error {
  constructor() {
    super("A user can upload at most 9 photos");
    this.name = "PhotoLimitError";
  }
}
