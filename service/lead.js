const LEAD = require("../model/lead");

exports.createLeadService = async (data) => {
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
