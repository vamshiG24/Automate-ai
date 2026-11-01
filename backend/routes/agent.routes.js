import express from "express";

import {
  createAgent,
  getAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
} from "../controllers/agent.controller.js";
import { protect } from "../middleware/protect.js";



const agentRouter = express.Router();

// All routes require authentication
agentRouter.use(protect);

agentRouter.post("/", createAgent);
agentRouter.get("/", getAgents);
agentRouter.get("/:id", getAgentById);
agentRouter.put("/:id", updateAgent);
agentRouter.delete("/:id", deleteAgent);

export default agentRouter;