import jwt from "jsonwebtoken";

// OAuth "state" tokens use their own secret so a leaked login JWT
// can never be replayed as an OAuth state (and vice versa).
const getStateSecret = () => {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET is missing.");
  }

  return secret;
};

export const signOAuthState = (userId, purpose) =>
  jwt.sign({ userId: String(userId), purpose }, getStateSecret(), {
    expiresIn: "10m",
  });

export const verifyOAuthState = (state, purpose) => {
  const decoded = jwt.verify(state, getStateSecret());

  if (decoded.purpose !== purpose || !decoded.userId) {
    throw new Error("Invalid OAuth state");
  }

  return decoded.userId;
};
