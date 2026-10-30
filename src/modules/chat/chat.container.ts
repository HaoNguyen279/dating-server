import { ChatController } from "./chat.controller.js";
import { ChatRepository } from "./chat.repository.js";
import { ChatService } from "./chat.service.js";

const chatRepository = new ChatRepository();
const chatService = new ChatService(chatRepository);

export const chatController = new ChatController(chatService);
