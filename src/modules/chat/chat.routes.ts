import { Router } from "express";
import { requireChatAuth } from "./chat.auth.js";
import { chatController } from "./chat.container.js";

const router = Router();

router.use(requireChatAuth);
router.get("/conversations", (req, res) => chatController.listConversations(req, res));
router.post("/matches/:matchId/conversation", (req, res) =>
  chatController.getOrCreateConversation(req, res),
);
router.get("/conversations/:conversationId", (req, res) =>
  chatController.getConversation(req, res),
);
router.post("/conversations/:conversationId/messages", (req, res) =>
  chatController.sendMessage(req, res),
);

export default router;
