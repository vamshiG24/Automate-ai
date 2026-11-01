
import { getRazorpay } from "../config/razorpay.js";

import crypto from "crypto";
import Payment from "../models/payment.model.js";
import User from "../models/user.model.js";


const Plans = {
  pro: {
    name: "Pro",
    amount: 29900, // ₹299
    credits: 500,
  },

  team: {
    name: "Team",
    amount: 79900, // ₹799
    credits: 2000,
  },
};

// CREATE ORDER
export const createOrder = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const { plan } = req.body;
    const selectedPlan = Plans[plan];

    if (!selectedPlan) {
      return res.status(400).json({
        message: "Invalid plan",
      });
    }

    // Create Razorpay order
    const order = await getRazorpay().orders.create({
      amount: selectedPlan.amount,
      currency: "INR",
      receipt: `receipt-${Date.now()}`,
      notes: { userId, plan },
    });

    // Save payment in database
    await Payment.create({
      userId,
      plan,
      credits: selectedPlan.credits,
      amount: selectedPlan.amount,
      razorpayOrderId: order.id,
      currency: "INR",
      status: "created",
    });

    return res.status(201).json({
      message: "Order created successfully",
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      plan: {
        name: selectedPlan.name,
        credits: selectedPlan.credits,
      },
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      message: "Unable to create order",
    });
  }
};

// VERIFY PAYMENT
export const verify = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string"
    ) {
      return res.status(400).json({
        message: "Payment verification details are required",
      });
    }

    // Find the payment belonging to this user
    const payment = await Payment.findOne({
      userId,
      razorpayOrderId: razorpay_order_id,
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found",
      });
    }

    // Prevent duplicate credit grants
    if (payment.status === "paid") {
      return res.status(200).json({
        message: "Payment already verified",
      });
    }

    // Generate expected signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // Compare signatures safely
    const received = Buffer.from(razorpay_signature, "hex");
    const expected = Buffer.from(generatedSignature, "hex");

    if (
      received.length !== expected.length ||
      !crypto.timingSafeEqual(received, expected)
    ) {
      return res.status(400).json({
        message: "Invalid payment signature",
      });
    }

    // Verify payment status with Razorpay
    const razorpayPayment = await getRazorpay().payments.fetch(
      razorpay_payment_id
    );

    if (
      razorpayPayment.order_id !== razorpay_order_id ||
      razorpayPayment.amount !== payment.amount ||
      razorpayPayment.currency !== payment.currency ||
      razorpayPayment.status !== "captured"
    ) {
      return res.status(400).json({
        message: "Payment is not captured or details do not match",
      });
    }

    // Atomically flip "created" -> "paid". If two verify requests race,
    // only one of them matches here, so credits are added exactly once.
    const claimedPayment = await Payment.findOneAndUpdate(
      {
        _id: payment._id,
        status: "created",
      },
      {
        $set: {
          status: "paid",
          razorpayPaymentId: razorpay_payment_id,
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (!claimedPayment) {
      return res.status(200).json({
        message: "Payment already verified",
      });
    }

    // Add purchased credits
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          credits: claimedPayment.credits,
        },
      },
      {
        returnDocument: "after",
      }
    );

    if (!user) {
      throw new Error("User not found");
    }

    return res.status(200).json({
      message: "Payment verified successfully",
      creditsAdded: claimedPayment.credits,
      remainingCredits: user.credits,
    });
  } catch (error) {
    console.error("Verify payment error:", error);

    return res.status(500).json({
      message: "Unable to verify payment",
    });
  }
};
