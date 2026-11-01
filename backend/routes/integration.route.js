import express from "express";
import {
  connectGoogle,
  getIntegrations,
  googleCallback,
  disconnectGoogle,
  connectInstagram,
  instagramCallback,
  getInstagramStatus,
  disconnectInstagram,
} from "../controllers/integration.controller.js";

import { protect } from "../middleware/protect.js";

const integrationRouter = express.Router();

// Google Integration
integrationRouter.get("/google/connect", protect, connectGoogle);
integrationRouter.get("/google/callback", googleCallback);
integrationRouter.post("/google/disconnect", protect, disconnectGoogle);

// Instagram Integration
integrationRouter.get("/instagram/auth", protect, connectInstagram);
integrationRouter.get("/instagram/callback", instagramCallback);
integrationRouter.get("/instagram/status", protect, getInstagramStatus);
integrationRouter.post("/instagram/disconnect", protect, disconnectInstagram);

// Get all integrations
integrationRouter.get("/", protect, getIntegrations);

export default integrationRouter;