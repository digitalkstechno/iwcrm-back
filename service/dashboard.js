const LEAD = require("../model/lead");
const DEALER = require("../model/dealer");
const STAFF = require("../model/staff");

exports.getDashboardStatsService = async () => {
  const totalLeads = await LEAD.countDocuments({});
  const newLeads = await LEAD.countDocuments({ pipelineStatus: "New" });
  const convertedLeads = await LEAD.countDocuments({ pipelineStatus: "Converted" });
  
  const totalDealers = await DEALER.countDocuments({});
  // Dealer status is default "active"
  const activeDealers = await DEALER.countDocuments({ status: { $regex: /^active$/i } });
  
  const totalStaff = await STAFF.countDocuments({});

  // Top Dealers Aggregation
  const topDealers = await LEAD.aggregate([
    { $match: { dealer: { $ne: null } } },
    { 
      $group: { 
        _id: "$dealer", 
        leadsCount: { $sum: 1 }, 
        convertedCount: { 
          $sum: { $cond: [{ $eq: ["$pipelineStatus", "Converted"] }, 1, 0] } 
        } 
      } 
    },
    { $lookup: { from: "dealers", localField: "_id", foreignField: "_id", as: "dealerInfo" } },
    { $unwind: "$dealerInfo" },
    { 
      $project: { 
        name: "$dealerInfo.DealerName", 
        region: "$dealerInfo.city", 
        leads: "$leadsCount", 
        convRate: { 
          $cond: [
            { $eq: ["$leadsCount", 0] },
            0,
            { $round: [ { $multiply: [ { $divide: ["$convertedCount", "$leadsCount"] }, 100 ] }, 0 ] }
          ]
        }
      } 
    },
    { $sort: { leads: -1 } },
    { $limit: 4 }
  ]);

  return {
    totalLeads,
    newLeads,
    convertedLeads,
    totalDealers,
    activeDealers,
    totalStaff,
    topDealers
  };
};
