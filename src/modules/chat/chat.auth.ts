import type { RequestHandler } from "express";
import prisma from "../../lib/prisma.js";
import { FirebaseService } from "../../services/firebase.service.js";

const firebaseService = new FirebaseService();

export type ChatAuth = {
  userId: string;
  firebaseUid: string;
};

export const requireChatAuth: RequestHandler = async (_req, res, next) => {
  try {
    const header = _req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      res.status(401).json({ success: false, message: "Missing bearer token" });
      return;
    }

    const decoded = await firebaseService.verifyIdToken(token);
    const user = await prisma.users.findUnique({
      where: { firebase_uid: decoded.uid },
      select: { id: true, firebase_uid: true, status: true },
    });

    if (!user || !user.firebase_uid) {
      res.status(401).json({ success: false, message: "User is not linked to Firebase" });
      return;
    }
    if (user.status !== "active") {
      res.status(403).json({ success: false, message: "User is not active" });
      return;
    }

    res.locals.chatAuth = {
      userId: user.id,
      firebaseUid: user.firebase_uid,
    } satisfies ChatAuth;
    next();
  } catch (error) {
    console.error("requireChatAuth error:", error);
    res.status(401).json({ success: false, message: "Invalid or expired Firebase token" });
  }
};

export function getChatAuth(res: Parameters<RequestHandler>[1]): ChatAuth {
  return res.locals.chatAuth as ChatAuth;
}

export { firebaseService as chatFirebaseService };
