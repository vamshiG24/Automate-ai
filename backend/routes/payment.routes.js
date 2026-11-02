import express from "express";


import { protect } from "../middleware/protect.js";
import { createOrder, demoPurchase, getPaymentConfig, verify } from "../controllers/payment.controller.js";



const paymentRouter = express.Router();

// All routes require authentication
paymentRouter.use(protect);

paymentRouter.get("/config", getPaymentConfig);
paymentRouter.post("/create", createOrder);
paymentRouter.post("/demo", demoPurchase);
paymentRouter.post("/verify", verify);


export default paymentRouter;