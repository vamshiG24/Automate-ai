
import User from "../models/user.model.js";

export const deductCredits = async ({ userId, credits }) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!Number.isInteger(credits) || credits <= 0) {
    throw new Error("Credits must be a positive integer");
  }

  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      credits: { $gte: credits },
    },
    {
      $inc: {
        credits: -credits,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    const existingUser = await User.exists({ _id: userId });

    if (!existingUser) {
      throw new Error("User not found");
    }

    throw new Error("Insufficient credits");
  }

  return {
    success: true,
    creditsDeducted: credits,
    remainingCredits: user.credits,
  };
};
