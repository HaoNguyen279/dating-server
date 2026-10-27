import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";

export class FirebaseError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "FirebaseError";
  }
}

export class FirebaseService {
  private readonly configured: boolean;
  private readonly auth: ReturnType<typeof getAuth> | null;

  constructor() {
    this.configured = Boolean(
      process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY
    );

    if (this.configured) {
      try {
        if (getApps().length === 0) {
          initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID!,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
              privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
            }),
          });
        }
        this.auth = getAuth();
      } catch (error) {
        console.error("Failed to initialize Firebase Admin SDK:", error);
        this.auth = null;
      }
    } else {
      this.auth = null;
    }
  }

  isConfigured(): boolean {
    return this.configured && this.auth !== null;
  }

  async verifyIdToken(token: string): Promise<DecodedIdToken> {
    if (!this.isConfigured()) {
      throw new FirebaseError(500, "Firebase is not configured");
    }

    try {
      return await this.auth!.verifyIdToken(token);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("expired")) {
          throw new FirebaseError(401, "Firebase ID token has expired");
        }
        if (error.message.includes("invalid")) {
          throw new FirebaseError(401, "Invalid Firebase ID token");
        }
        throw new FirebaseError(401, "Failed to verify Firebase ID token");
      }
      throw error;
    }
  }
}
