import express from "express";
import {
  createPlan,
  getRuns,
  getRun,
  updatePlan,
  executeRun,
  approveStep,
  deleteRun,
  getPendingApprovals,
} from "../controllers/team.controller.js";
import { protect } from "../middleware/protect.js";

const teamRouter = express.Router();

// All routes require authentication
teamRouter.use(protect);

teamRouter.post("/plan", createPlan);
teamRouter.get("/pending", getPendingApprovals);
teamRouter.get("/runs", getRuns);
teamRouter.get("/runs/:id", getRun);
teamRouter.patch("/runs/:id", updatePlan);
teamRouter.post("/runs/:id/execute", executeRun);
teamRouter.post("/runs/:id/approve", approveStep);
teamRouter.delete("/runs/:id", deleteRun);

export default teamRouter;
