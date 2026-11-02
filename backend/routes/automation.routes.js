import express from "express";
import {
  getAutomations,
  createAutomation,
  updateAutomation,
  runAutomationNow,
  deleteAutomation,
} from "../controllers/automation.controller.js";
import { protect } from "../middleware/protect.js";

const automationRouter = express.Router();

// All routes require authentication
automationRouter.use(protect);

automationRouter.get("/", getAutomations);
automationRouter.post("/", createAutomation);
automationRouter.patch("/:id", updateAutomation);
automationRouter.post("/:id/run", runAutomationNow);
automationRouter.delete("/:id", deleteAutomation);

export default automationRouter;
