import Razorpay from "razorpay";

let razorpay;

// .env.example values like "rzp_test_your_key_id" count as not set
const isPlaceholder = (value = "") => !value.trim() || /^add |your_/i.test(value.trim());

// Real keys look like rzp_test_... / rzp_live_..., not the .env.example text
export const razorpayConfigured = () =>
  !isPlaceholder(process.env.RAZORPAY_KEY_ID) && !isPlaceholder(process.env.RAZORPAY_KEY_SECRET);

// Demo checkout (no real money) for local demos without Razorpay keys.
// Never in production, and real keys always win.
export const demoPaymentsEnabled = () =>
  process.env.PAYMENTS_DEMO_MODE === "true" &&
  process.env.NODE_ENV !== "production" &&
  !razorpayConfigured();

// Created on first use so a missing key only breaks payments,
// not the whole server at startup.
export const getRazorpay = () => {
  if (razorpay) {
    return razorpay;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayConfigured()) {
    throw new Error("Razorpay credentials are missing.");
  }

  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpay;
};
