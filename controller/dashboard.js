const { getDashboardStatsService } = require("../service/dashboard");

exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await getDashboardStatsService();
    return res.status(200).json({
      status: "Success",
      message: "Dashboard metrics fetched successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    return res.status(500).json({
      status: "Fail",
      message: error.message || "Failed to fetch dashboard metrics",
    });
  }
};
