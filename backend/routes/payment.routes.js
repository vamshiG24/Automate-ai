import express from "express";


import { protect } from "../middleware/protect.js";
import { createOrder, verify } from "../controllers/payment.controller.js";



const paymentRouter = express.Router();

// All routes require authentication
paymentRouter.use(protect);

paymentRouter.post("/create", createOrder);
paymentRouter.post("/verify", verify);


export default paymentRouter;