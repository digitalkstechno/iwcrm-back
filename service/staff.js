const STAFF = require("../model/staff");
const { encryptData, decryptData } = require("../utils/crypto");
const jwt = require("jsonwebtoken");

exports.createStaffService = async ({ fullName, email, phone, password }) => {
  const encryptedPassword = encryptData(password);
  const staffData = { fullName, email, phone, status: "active", password: encryptedPassword };
  const staffDetails = await STAFF.create(staffData);
  return staffDetails;
};

exports.loginStaffService = async ({ email, password }) => {
  const staffverify = await STAFF.findOne({ email });
  if (!staffverify) throw new Error("Invalid Email or password");

  const decryptedPassword = decryptData(staffverify.password);
  if (String(decryptedPassword) !== password) throw new Error("Invalid password");

  const token = jwt.sign({ id: staffverify._id }, process.env.JWT_SECRET_KEY);
  return { staff: staffverify, token };
};

exports.fetchAllStaffsService = async ({ page, limit, search }) => {
  const skip = (page - 1) * limit;
  const query = {
    $or: [
      { fullName: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
    ],
  };
  const totalStaff = await STAFF.countDocuments(query);
  const staffsData = await STAFF.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
  return { totalStaff, staffsData, page, limit };
};

exports.fetchStaffByIdService = async (staffId) => {
  const staffData = await STAFF.findById(staffId);
  if (!staffData) throw new Error("Staff not found");
  return staffData;
};

exports.staffUpdateService = async (staffId, body) => {
  const oldStaff = await STAFF.findById(staffId);
  if (!oldStaff) throw new Error("Staff not found");
  if (body.password) body.password = encryptData(body.password);
  const updatedStaff = await STAFF.findByIdAndUpdate(staffId, body, { new: true });
  return updatedStaff;
};

exports.staffDeleteService = async (staffId) => {
  const oldStaff = await STAFF.findById(staffId);
  if (!oldStaff) throw new Error("Staff not found");
  await STAFF.findByIdAndDelete(staffId);
};
