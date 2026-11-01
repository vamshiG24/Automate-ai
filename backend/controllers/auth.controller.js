
import { getAuth } from "firebase-admin/auth";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { app } from "../config/firebase.js";


const isProduction = process.env.NODE_ENV === "production";

// In production the frontend and API usually live on different domains,
// which needs SameSite=None + Secure. Locally (http) we use Lax.
const baseCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

const cookieOptions = {
  ...baseCookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const login = async (req, res) => {
  try {
    const { token: firebaseToken } = req.body;

    if (!firebaseToken) {
      return res.status(401).json({
        success: false,
        message: "Firebase ID token is required.",
      });
    }

    const decoded = await getAuth(app).verifyIdToken(firebaseToken);

    if (!decoded.uid || !decoded.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid Firebase user information.",
      });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: decoded.uid },
      {
        $set: {
          name: decoded.name || "User",
          email: decoded.email.toLowerCase(),
          profilePicture: decoded.picture || "",
        },
        $setOnInsert: {
          firebaseUid: decoded.uid,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
      }
    );

  

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing.");
    }

    const jwtToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", jwtToken, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        credits: user.credits,
        autoApproveLowRisk: Boolean(user.autoApproveLowRisk),
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

   
    return res.status(500).json({
      success: false,
      message: "Login failed.",
    });
  }
};

export const logOut = async (req, res) => {
  // Must use the same options the cookie was set with, or it won't clear
  res.clearCookie("token", baseCookieOptions);

  return res.status(200).json({
    success: true,
    message: "Logout successful.",
  });
};

export const me = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        firebaseUid: req.user.firebaseUid,
        name: req.user.name,
        email: req.user.email,
        profilePicture: req.user.profilePicture,
        credits:req.user.credits,
        autoApproveLowRisk: Boolean(req.user.autoApproveLowRisk),
      },
    });
  } catch (error) {
    console.error("Me controller error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch user.",
    });
  }
};
// PATCH /api/auth/settings  { autoApproveLowRisk }
export const updateSettings = async (req, res) => {
  try {
    const { autoApproveLowRisk } = req.body;

    if (typeof autoApproveLowRisk !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "autoApproveLowRisk must be a boolean.",
      });
    }

    req.user.autoApproveLowRisk = autoApproveLowRisk;
    await req.user.save();

    return res.status(200).json({
      success: true,
      settings: { autoApproveLowRisk },
    });
  } catch (error) {
    console.error("Update settings error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update settings.",
    });
  }
};
