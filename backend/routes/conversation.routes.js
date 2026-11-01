import express from "express";
import {
  getConversations,
  getConversationById,
  updateConversation,
  deleteConversation,
} from "../controllers/conversation.controller.js";
import { protect } from "../middleware/protect.js";

const conversationRouter = express.Router();

// All routes require authentication
conversationRouter.use(protect);

conversationRouter.get("/", getConversations);
conversationRouter.get("/:threadId", getConversationById);
conversationRouter.patch("/:threadId", updateConversation);
conversationRouter.delete("/:threadId", deleteConversation);

export default conversationRouter;
