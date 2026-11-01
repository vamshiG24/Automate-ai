import ApprovalDecision from "../models/approvalDecision.model.js";

// GET /api/approvals/stats
// Summary of the user's approval history: how many actions were
// auto-approved vs reviewed, and how often risky actions were rejected.
export const getApprovalStats = async (req, res) => {
  try {
    const [byLevel, totals, recent] = await Promise.all([
      ApprovalDecision.aggregate([
        { $match: { userId: req.user._id } },
        {
          $group: {
            _id: "$riskLevel",
            total: { $sum: 1 },
            approved: { $sum: { $cond: ["$approved", 1, 0] } },
            autoApproved: { $sum: { $cond: ["$autoApproved", 1, 0] } },
          },
        },
      ]),
      ApprovalDecision.aggregate([
        { $match: { userId: req.user._id } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            autoApproved: { $sum: { $cond: ["$autoApproved", 1, 0] } },
            approved: { $sum: { $cond: ["$approved", 1, 0] } },
            injectionFlags: {
              $sum: {
                $cond: [
                  { $in: ["recipient_from_untrusted_content", "$riskFactors"] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      ApprovalDecision.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("toolName target riskScore riskLevel approved autoApproved source createdAt"),
    ]);

    const summary = totals[0] || {
      total: 0,
      autoApproved: 0,
      approved: 0,
      injectionFlags: 0,
    };

    return res.status(200).json({
      success: true,
      stats: {
        total: summary.total,
        autoApproved: summary.autoApproved,
        manuallyReviewed: summary.total - summary.autoApproved,
        rejected: summary.total - summary.approved,
        injectionFlags: summary.injectionFlags,
        // Share of approval cards the user did NOT have to click
        clicksSavedPercent: summary.total
          ? Math.round((summary.autoApproved / summary.total) * 100)
          : 0,
        byLevel: Object.fromEntries(
          ["low", "medium", "high"].map((level) => {
            const row = byLevel.find((item) => item._id === level);
            return [
              level,
              {
                total: row?.total || 0,
                approved: row?.approved || 0,
                autoApproved: row?.autoApproved || 0,
              },
            ];
          })
        ),
        recent,
      },
    });
  } catch (error) {
    console.error("Approval stats error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to load approval stats.",
    });
  }
};
