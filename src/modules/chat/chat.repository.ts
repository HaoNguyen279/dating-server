import prisma from "../../lib/prisma.js";

const partnerSelect = {
  id: true,
  firebase_uid: true,
  profiles: {
    select: {
      display_name: true,
      birth_date: true,
      job_title: true,
      city: true,
      is_verified: true,
    },
  },
  photos: {
    where: { is_primary: true },
    select: { url: true, is_primary: true },
    take: 1,
  },
} as const;

export class ChatRepository {
  findMatch(matchId: string) {
    return prisma.matches.findUnique({
      where: { id: matchId },
      include: {
        users_matches_user1_idTousers: { select: partnerSelect },
        users_matches_user2_idTousers: { select: partnerSelect },
      },
    });
  }

  findConversation(conversationId: string) {
    return prisma.conversations.findUnique({
      where: { id: conversationId },
      include: {
        matches: {
          include: {
            users_matches_user1_idTousers: { select: partnerSelect },
            users_matches_user2_idTousers: { select: partnerSelect },
          },
        },
      },
    });
  }

  findOrCreateConversation(matchId: string) {
    return prisma.conversations.upsert({
      where: { match_id: matchId },
      update: {},
      create: { match_id: matchId },
    });
  }

  listForUser(userId: string, limit: number) {
    return prisma.conversations.findMany({
      where: {
        matches: {
          status: "active",
          OR: [{ user1_id: userId }, { user2_id: userId }],
        },
      },
      orderBy: [{ last_message_at: "desc" }, { created_at: "desc" }],
      take: limit,
      include: {
        matches: {
          include: {
            users_matches_user1_idTousers: { select: partnerSelect },
            users_matches_user2_idTousers: { select: partnerSelect },
          },
        },
      },
    });
  }

  updateLastMessageAt(conversationId: string, date: Date) {
    return prisma.conversations.update({
      where: { id: conversationId },
      data: { last_message_at: date },
    });
  }
}
