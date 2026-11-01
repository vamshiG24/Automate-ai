import express from "express";
import { chatWithAI } from "../controllers/chat.controller.js";
import { protect } from "../middleware/protect.js";


const chatRouter = express.Router();

chatRouter.post("/", protect, chatWithAI);

export default chatRouter;