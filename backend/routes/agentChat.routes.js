import express from "express";
import { approveEmail, chatWithAgent } from "../controllers/agentChat.controller.js";
import { protect } from "../middleware/protect.js";


const agentChatRouter = express.Router();

agentChatRouter.use(protect);

agentChatRouter.post("/", chatWithAgent);
agentChatRouter.post("/approve-email", protect, approveEmail);
export default agentChatRouter;