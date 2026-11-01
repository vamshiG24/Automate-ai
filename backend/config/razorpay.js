import Razorpay from "razorpay";

let razorpay;

// Created on first use so a missing key only breaks payments,
// not the whole server at startup.
export const getRazorpay = () => {
  if (razorpay) {
    return razorpay;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are missing.");
  }

  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpay;
};
