const LEAD = require("../model/lead");
const DEALER = require("../model/dealer");

const getLevenshteinDistance = (a, b) => {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[a.length][b.length];
};

const autoAssignDealerByCity = async (city) => {
  if (!city) return null;
  const allDealers = await DEALER.find({}, 'city _id');
  let bestMatch = null;
  let lowestDistance = Infinity;

  allDealers.forEach(d => {
    if (!d.city) return;
    const cityA = d.city.toLowerCase();
    const cityB = city.toLowerCase();
    
    if (cityA === cityB) {
      bestMatch = { dealerId: d._id, city: d.city };
      lowestDistance = 0;
      return;
    }

    const distance = getLevenshteinDistance(cityA, cityB);
    const threshold = cityB.length >= 4 ? 2 : 1;

    if (distance <= threshold && distance < lowestDistance) {
      bestMatch = { dealerId: d._id, city: d.city };
      lowestDistance = distance;
    }
  });

  return bestMatch;
};

exports.createLeadService = async (data) => {
  // If dealer is not explicitly provided, try to auto-assign based on city
  if (!data.dealer && data.city) {
    const assigned = await autoAssignDealerByCity(data.city);
    if (assigned) {
      data.dealer = assigned.dealerId;
      data.city = assigned.city; // Auto-correct spelling mistake
    }
  }

  const leadDetails = await LEAD.create(data);
  return leadDetails;
};

exports.fetchAllLeadsService = async ({ page, limit, search }) => {
  const skip = (page - 1) * limit;
  const query = {};
  if (search) {
    query.$or = [
      { contactName: { $regex: search, $options: "i" } },
      { companyName: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { pipelineStatus: { $regex: search, $options: "i" } },
      { priority: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
    ];
  }
  const totalLead = await LEAD.countDocuments(query);
  const leadsData = await LEAD.find(query)
    .populate("staff", "fullName email")
    .populate("dealer", "DealerName Phone")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });
  return { totalLead, leadsData, page, limit };
};

exports.fetchLeadByIdService = async (leadId) => {
  const leadData = await LEAD.findById(leadId)
    .populate("staff", "fullName email")
    .populate("dealer", "DealerName Phone");
  if (!leadData) throw new Error("Lead not found");
  return leadData;
};

exports.leadUpdateService = async (leadId, body) => {
  const oldLead = await LEAD.findById(leadId);
  if (!oldLead) throw new Error("Lead not found");

  // If city is updated and no new dealer is explicitly provided, try to auto-assign
  if (body.city && body.city !== oldLead.city && !body.dealer) {
    const assigned = await autoAssignDealerByCity(body.city);
    if (assigned) {
      body.dealer = assigned.dealerId;
      body.city = assigned.city; // Auto-correct spelling mistake
    }
  }

  const updatedLead = await LEAD.findByIdAndUpdate(leadId, body, { new: true })
    .populate("staff", "fullName email")
    .populate("dealer", "DealerName Phone");
  return updatedLead;
};

exports.leadDeleteService = async (leadId) => {
  const oldLead = await LEAD.findById(leadId);
  if (!oldLead) throw new Error("Lead not found");
  await LEAD.findByIdAndDelete(leadId);
};
