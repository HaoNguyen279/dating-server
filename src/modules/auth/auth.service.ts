import { OAuth2Client } from "google-auth-library";
import { hashPassword, verifyPassword } from "../users/users.service.js";
import { AuthRepository } from "./auth.repository.js";
import { FirebaseService } from "../../services/firebase.service.js";
import type { LoginInput, RegisterInput } from "./auth.validation.js";

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthService {
  private readonly googleClient = new OAuth2Client();
  private readonly firebaseService = new FirebaseService();

  constructor(private readonly authRepository: AuthRepository) {}

  async register(input: RegisterInput) {
    const email = input.email?.trim().toLowerCase() ?? null;
    const phone = input.phone?.trim() ?? null;

    if (email && (await this.authRepository.findByEmail(email))) {
      throw new AuthError(409, "Email is already registered");
    }
    if (phone && (await this.authRepository.findByPhone(phone))) {
      throw new AuthError(409, "Phone number is already registered");
    }

    try {
      const user = await this.authRepository.createPasswordUser(email, phone, hashPassword(input.password));
      return { user };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new AuthError(409, "Email or phone number is already registered");
      }
      throw error;
    }
  }

  async login(input: LoginInput) {
    const identifier = input.identifier.trim();
    const isEmail = identifier.includes("@");
    const normalizedIdentifier = isEmail ? identifier.toLowerCase() : identifier;
    const account = isEmail
      ? await this.authRepository.findPasswordUserByEmail(normalizedIdentifier)
      : await this.authRepository.findPasswordUserByPhone(normalizedIdentifier);

    if (!account?.password_hash || !verifyPassword(input.password, account.password_hash)) {
      throw new AuthError(401, "Invalid email/phone or password");
    }
    if (account.status !== "active") {
      throw new AuthError(403, "This account is not active");
    }

    return { user: await this.authRepository.recordSignIn(account.id) };
  }

  async signInWithGoogle(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new AuthError(500, "Google Sign-In is not configured on the server");
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new AuthError(401, "Invalid or expired Google ID token");
    }

    if (!payload?.sub) {
      throw new AuthError(401, "Invalid Google ID token");
    }

    const googleSub = payload.sub;
    const email = payload.email_verified && payload.email
      ? payload.email.trim().toLowerCase()
      : null;

    const existingUser = await this.authRepository.findByGoogleSub(googleSub);
    if (existingUser) {
      if (existingUser.status !== "active") {
        throw new AuthError(403, "This account is not active");
      }

      return {
        user: await this.authRepository.recordSignIn(existingUser.id),
        isNewUser: false,
      };
    }

    try {
      const user = await this.authRepository.createGoogleUser(googleSub, email);
      return { user, isNewUser: true };
    } catch (error) {
      // A concurrent first sign-in may have inserted this Google sub after our lookup.
      let userCreatedByConcurrentRequest = await this.authRepository.findByGoogleSub(googleSub);

      // The database may enforce unique emails for existing password accounts. Keep Google
      // identity keyed by sub instead of silently linking it to an account by email.
      if (!userCreatedByConcurrentRequest && email && this.isUniqueConstraintError(error)) {
        try {
          const user = await this.authRepository.createGoogleUser(googleSub, null);
          return { user, isNewUser: true };
        } catch (retryError) {
          userCreatedByConcurrentRequest = await this.authRepository.findByGoogleSub(googleSub);
          if (!userCreatedByConcurrentRequest) {
            throw retryError;
          }
        }
      }

      if (!userCreatedByConcurrentRequest) throw error;

      if (userCreatedByConcurrentRequest.status !== "active") {
        throw new AuthError(403, "This account is not active");
      }

      return {
        user: await this.authRepository.recordSignIn(userCreatedByConcurrentRequest.id),
        isNewUser: false,
      };
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }

  async signInWithFirebase(idToken: string) {
    if (!this.firebaseService.isConfigured()) {
      throw new AuthError(500, "Firebase is not configured on the server");
    }

    let decodedToken;
    try {
      decodedToken = await this.firebaseService.verifyIdToken(idToken);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Firebase")) {
        throw error;
      }
      throw new AuthError(401, "Invalid or expired Firebase ID token");
    }

    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email_verified && decodedToken.email
      ? decodedToken.email.trim().toLowerCase()
      : null;

    const existingUser = await this.authRepository.findByFirebaseUid(firebaseUid);
    if (existingUser) {
      if (existingUser.status !== "active") {
        throw new AuthError(403, "This account is not active");
      }

      return {
        user: await this.authRepository.recordSignIn(existingUser.id),
        isNewUser: false,
      };
    }

    try {
      const user = await this.authRepository.createFirebaseUser(firebaseUid, email);
      return { user, isNewUser: true };
    } catch (error) {
      // A concurrent first sign-in may have inserted this Firebase UID after our lookup.
      let userCreatedByConcurrentRequest = await this.authRepository.findByFirebaseUid(firebaseUid);

      // The database may enforce unique emails for existing password accounts. Keep Firebase
      // identity keyed by UID instead of silently linking it to an account by email.
      if (!userCreatedByConcurrentRequest && email && this.isUniqueConstraintError(error)) {
        try {
          const user = await this.authRepository.createFirebaseUser(firebaseUid, null);
          return { user, isNewUser: true };
        } catch (retryError) {
          userCreatedByConcurrentRequest = await this.authRepository.findByFirebaseUid(firebaseUid);
          if (!userCreatedByConcurrentRequest) {
            throw retryError;
          }
        }
      }

      if (!userCreatedByConcurrentRequest) throw error;

      if (userCreatedByConcurrentRequest.status !== "active") {
        throw new AuthError(403, "This account is not active");
      }

      return {
        user: await this.authRepository.recordSignIn(userCreatedByConcurrentRequest.id),
        isNewUser: false,
      };
    }
  }

  async syncPhoneVerification(idToken: string) {
    let decodedToken;
    try {
      decodedToken = await this.firebaseService.verifyIdToken(idToken);
    } catch {
      throw new AuthError(401, "Invalid or expired Firebase ID token");
    }

    const firebaseUser = await this.firebaseService.getUser(decodedToken.uid);
    if (!firebaseUser.phoneNumber) {
      throw new AuthError(400, "A verified phone number is not linked to this Firebase account");
    }

    const profileUpdated = await this.authRepository.setProfileVerifiedByFirebaseUid(
      decodedToken.uid,
      true,
    );
    if (!profileUpdated) {
      throw new AuthError(404, "Profile not found for this Firebase account");
    }

    return { is_verified: true };
  }

  async createNativePhoneSession(idToken: string) {
    let decodedToken;
    try {
      decodedToken = await this.firebaseService.verifyIdToken(idToken);
    } catch {
      throw new AuthError(401, "Invalid or expired Firebase ID token");
    }

    const account = await this.authRepository.findByFirebaseUid(decodedToken.uid);
    if (!account || account.status !== "active") {
      throw new AuthError(403, "A signed-in Firebase account is required");
    }

    const customToken = await this.firebaseService.createCustomToken(decodedToken.uid);
    return { customToken };
  }
}
