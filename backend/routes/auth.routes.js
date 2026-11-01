import { Router } from "express";
import { login, logOut, me, updateSettings } from "../controllers/auth.controller.js";
import { protect } from "../middleware/protect.js";


const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/logout", logOut);
authRouter.get("/me", protect,me);
authRouter.patch("/settings", protect, updateSettings);

export default authRouter;