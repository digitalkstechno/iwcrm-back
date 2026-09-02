const {
  createLeadService,
  fetchAllLeadsService,
  fetchLeadByIdService,
  leadUpdateService,
  leadDeleteService,
} = require("../service/lead");

exports.leadCreate = async (req, res) => {
  try {
    const leadDetails = await createLeadService(req.body);
    return res.status(201).json({ status: "Success", message: "Lead created successfully", data: leadDetails });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

exports.leadList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const leadsData = await fetchAllLeadsService({ page, limit, search });
    
    return res.status(200).json({
      status: "Success",
      message: "Leads fetched successfully",
      data: leadsData.leadsData,
      pagination: {
        totalRecords: leadsData.totalLead,
        totalPages: Math.ceil(leadsData.totalLead / limit),
        currentPage: page,
        limit: limit,
      },
    });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

exports.leadListById = async (req, res) => {
  try {
    const leadData = await fetchLeadByIdService(req.params.id);
    return res.status(200).json({ status: "Success", message: "Lead fetched successfully", data: leadData });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

exports.leadUpdate = async (req, res) => {
  try {
    const updatedLead = await leadUpdateService(req.params.id, req.body);
    return res.status(200).json({ status: "Success", message: "Lead updated successfully", data: updatedLead });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

exports.leadDelete = async (req, res) => {
  try {
    await leadDeleteService(req.params.id);
    return res.status(200).json({ status: "Success", message: "Lead deleted successfully" });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};
