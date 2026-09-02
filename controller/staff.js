const {
  createStaffService,
  loginStaffService,
  fetchAllStaffsService,
  fetchStaffByIdService,
  staffUpdateService,
  staffDeleteService,
} = require("../service/staff");

exports.createStaff = async (req, res) => {
  try {
    const staffDetails = await createStaffService(req.body);
    return res.status(201).json({ status: "Success", message: "Staff created successfully", data: staffDetails });
  } catch (error) {
    return res.status(400).json({ status: "Fail", message: error.message });
  }
};

exports.loginStaff = async (req, res) => {
  try {
    const { staff, token } = await loginStaffService(req.body);
    return res.status(200).json({ status: "Success", message: "Staff logged in successfully", data: staff, token });
  } catch (error) {
    return res.status(400).json({ status: "Fail", message: error.message });
  }
};

exports.fetchAllStaffs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const { totalStaff, staffsData } = await fetchAllStaffsService({ page, limit, search });
    return res.status(200).json({
      status: "Success",
      message: "Staffs fetched successfully",
      pagination: { totalRecords: totalStaff, currentPage: page, totalPages: Math.ceil(totalStaff / limit), limit },
      data: staffsData,
    });
  } catch (error) {
    return res.status(500).json({ status: "Fail", message: error.message });
  }
};

exports.fetchStaffById = async (req, res) => {
  try {
    const staffData = await fetchStaffByIdService(req.params.id);
    return res.status(200).json({ status: "Success", message: "Staff fetched successfully", data: staffData });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

exports.getCurrentStaff = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ status: "Fail", message: "Unauthorized" });
    return res.status(200).json({ status: "Success", data: req.user });
  } catch (error) {
    return res.status(500).json({ status: "Fail", message: error.message });
  }
};

exports.staffUpdate = async (req, res) => {
  try {
    const updatedStaff = await staffUpdateService(req.params.id, req.body);
    return res.status(200).json({ status: "Success", message: "Staff updated successfully", data: updatedStaff });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

exports.staffDelete = async (req, res) => {
  try {
    await staffDeleteService(req.params.id);
    return res.status(200).json({ status: "Success", message: "Staff deleted successfully" });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};
