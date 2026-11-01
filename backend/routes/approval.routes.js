import express from "express";
import { getApprovalStats } from "../controllers/approval.controller.js";
import { protect } from "../middleware/protect.js";

const approvalRouter = express.Router();

approvalRouter.use(protect);

approvalRouter.get("/stats", getApprovalStats);

export default approvalRouter;
