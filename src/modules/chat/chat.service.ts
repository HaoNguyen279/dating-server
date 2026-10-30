import { FieldValue } from "firebase-admin/firestore";
import type { ChatAuth } from "./chat.auth.js";
import { chatFirebaseService } from "./chat.auth.js";
import { ChatRepository } from "./chat.repository.js";

export class ChatHttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "ChatHttpError";
  }
}

function partnerFor(match: NonNullable<Awaited<ReturnType<ChatRepository["findMatch"]>>>, userId: string) {
  const partner = match.user1_id === userId
    ? match.users_matches_user2_idTousers
    : match.users_matches_user1_idTousers;
  return {
    id: partner.id,
    firebaseUid: partner.firebase_uid,
    name: partner.profiles?.display_name ?? "User",
    birthDate: partner.profiles?.birth_date ?? null,
    occupation: partner.profiles?.job_title ?? null,
    city: partner.profiles?.city ?? null,
    verified: partner.profiles?.is_verified ?? false,
    avatar: partner.photos[0]?.url ?? null,
  };
}

function ensureActiveMember(
  match: { status: string; user1_id: string; user2_id: string },
  userId: string,
) {
  if (match.user1_id !== userId && match.user2_id !== userId) {
    throw new ChatHttpError(403, "You are not a participant of this match");
  }
  if (match.status !== "active") {
    throw new ChatHttpError(403, "This match is no longer active");
  }
}

export class ChatService {
  constructor(private readonly repository: ChatRepository) {}

  private get firestore() {
    return chatFirebaseService.getFirestore();
  }

  private async ensureFirestoreConversation(
    conversationId: string,
    matchId: string,
    participantUids: string[],
  ) {
    const ref = this.firestore.collection("conversations").doc(conversationId);
    await this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        transaction.create(ref, {
          matchId,
          participantUids,
          lastMessageText: "",
          lastMessageSenderUid: null,
          lastMessageAt: null,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    });
    return ref;
  }

  async getOrCreateConversation(matchId: string, auth: ChatAuth) {
    const match = await this.repository.findMatch(matchId);
    if (!match) throw new ChatHttpError(404, "Match not found");
    ensureActiveMember(match, auth.userId);

    const uid1 = match.users_matches_user1_idTousers.firebase_uid;
    const uid2 = match.users_matches_user2_idTousers.firebase_uid;
    if (!uid1 || !uid2) {
      throw new ChatHttpError(409, "Both users must be linked to Firebase before chatting");
    }

    const conversation = await this.repository.findOrCreateConversation(matchId);
    await this.ensureFirestoreConversation(conversation.id, match.id, [uid1, uid2]);

    return {
      conversationId: conversation.id,
      matchId: match.id,
      partner: partnerFor(match, auth.userId),
    };
  }

  async getConversation(conversationId: string, auth: ChatAuth) {
    const conversation = await this.repository.findConversation(conversationId);
    if (!conversation) throw new ChatHttpError(404, "Conversation not found");
    ensureActiveMember(conversation.matches, auth.userId);

    const uid1 = conversation.matches.users_matches_user1_idTousers.firebase_uid;
    const uid2 = conversation.matches.users_matches_user2_idTousers.firebase_uid;
    if (!uid1 || !uid2) throw new ChatHttpError(409, "Conversation users are not linked to Firebase");

    const ref = await this.ensureFirestoreConversation(
      conversation.id,
      conversation.matches.id,
      [uid1, uid2],
    );
    const snapshot = await ref.get();

    return {
      conversationId: conversation.id,
      matchId: conversation.matches.id,
      partner: partnerFor(conversation.matches, auth.userId),
      lastMessage: snapshot.data()?.lastMessageText ?? "",
      lastMessageAt: snapshot.data()?.lastMessageAt?.toDate?.().toISOString() ?? null,
    };
  }

  async listConversations(auth: ChatAuth) {
    const rows = await this.repository.listForUser(auth.userId, 50);
    const items = await Promise.all(rows.map(async (conversation) => {
      const match = conversation.matches;
      const uid1 = match.users_matches_user1_idTousers.firebase_uid;
      const uid2 = match.users_matches_user2_idTousers.firebase_uid;
      if (!uid1 || !uid2) return null;

      const ref = await this.ensureFirestoreConversation(conversation.id, match.id, [uid1, uid2]);
      const snapshot = await ref.get();
      const data = snapshot.data();
      return {
        conversationId: conversation.id,
        matchId: match.id,
        partner: partnerFor(match, auth.userId),
        lastMessage: data?.lastMessageText ?? "",
        lastMessageAt: data?.lastMessageAt?.toDate?.().toISOString() ?? null,
      };
    }));
    return items.filter((item): item is Exclude<typeof item, null> => item !== null);
  }

  async sendMessage(
    conversationId: string,
    auth: ChatAuth,
    input: { clientMessageId: string; text: string },
  ) {
    const text = input.text.trim();
    if (!text) throw new ChatHttpError(400, "Message cannot be empty");
    if (text.length > 2000) throw new ChatHttpError(400, "Message cannot exceed 2000 characters");

    const conversation = await this.repository.findConversation(conversationId);
    if (!conversation) throw new ChatHttpError(404, "Conversation not found");
    ensureActiveMember(conversation.matches, auth.userId);

    const uid1 = conversation.matches.users_matches_user1_idTousers.firebase_uid;
    const uid2 = conversation.matches.users_matches_user2_idTousers.firebase_uid;
    if (!uid1 || !uid2) throw new ChatHttpError(409, "Conversation users are not linked to Firebase");

    const roomRef = await this.ensureFirestoreConversation(conversation.id, conversation.matches.id, [uid1, uid2]);
    const messageRef = roomRef.collection("messages").doc(input.clientMessageId);
    const sentAt = new Date();

    await this.firestore.runTransaction(async (transaction) => {
      const existing = await transaction.get(messageRef);
      if (existing.exists) return; // Idempotent retry from the app.
      transaction.create(messageRef, {
        senderUid: auth.firebaseUid,
        text,
        type: "text",
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(roomRef, {
        lastMessageText: text,
        lastMessageSenderUid: auth.firebaseUid,
        lastMessageAt: FieldValue.serverTimestamp(),
      });
    });

    await this.repository.updateLastMessageAt(conversation.id, sentAt);
    return {
      id: input.clientMessageId,
      senderUid: auth.firebaseUid,
      text,
      type: "text",
      createdAt: sentAt.toISOString(),
    };
  }
}
