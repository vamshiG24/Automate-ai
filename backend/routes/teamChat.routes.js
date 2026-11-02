import express from "express";
import { approveTeamAction, sendTeamMessage } from "../controllers/teamChat.controller.js";
import { protect } from "../middleware/protect.js";

const teamChatRouter = express.Router();

// All routes require authentication; both respond with a live event stream
teamChatRouter.use(protect);

teamChatRouter.post("/message", sendTeamMessage);
teamChatRouter.post("/approve", approveTeamAction);

export default teamChatRouter;
