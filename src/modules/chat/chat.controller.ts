import type { Request, Response } from "express";
import { z } from "zod";
import { getChatAuth } from "./chat.auth.js";
import { ChatHttpError, ChatService } from "./chat.service.js";

const uuidParams = z.object({ matchId: z.string().uuid() });
const conversationParams = z.object({ conversationId: z.string().uuid() });
const sendMessageSchema = z.object({
  // Firestore auto IDs are not UUIDs (usually 20 alphanumeric characters).
  // Limit the accepted ID alphabet so it is safe to use as a document ID.
  clientMessageId: z.string().min(10).max(128).regex(/^[A-Za-z0-9_-]+$/),
  text: z.string().trim().min(1).max(2000),
});

export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private handleError(res: Response, error: unknown, action: string) {
    if (error instanceof ChatHttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error(`ChatController.${action} error:`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }

  async getOrCreateConversation(req: Request, res: Response) {
    try {
      const parsed = uuidParams.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "matchId must be a UUID" });
      }
      const data = await this.chatService.getOrCreateConversation(
        parsed.data.matchId,
        getChatAuth(res),
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.handleError(res, error, "getOrCreateConversation");
    }
  }

  async getConversation(req: Request, res: Response) {
    try {
      const parsed = conversationParams.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "conversationId must be a UUID" });
      }
      const data = await this.chatService.getConversation(
        parsed.data.conversationId,
        getChatAuth(res),
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.handleError(res, error, "getConversation");
    }
  }

  async listConversations(_req: Request, res: Response) {
    try {
      const data = await this.chatService.listConversations(getChatAuth(res));
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return this.handleError(res, error, "listConversations");
    }
  }

  async sendMessage(req: Request, res: Response) {
    try {
      const params = conversationParams.safeParse(req.params);
      const body = sendMessageSchema.safeParse(req.body);
      if (!params.success || !body.success) {
        return res.status(400).json({
          success: false,
          message: "Invalid conversationId or message payload",
          errors: body.success ? undefined : body.error.flatten().fieldErrors,
        });
      }
      const data = await this.chatService.sendMessage(
        params.data.conversationId,
        getChatAuth(res),
        body.data,
      );
      return res.status(201).json({ success: true, data });
    } catch (error) {
      return this.handleError(res, error, "sendMessage");
    }
  }
}
