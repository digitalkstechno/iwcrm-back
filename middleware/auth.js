const jwt = require("jsonwebtoken");
const STAFF = require("../model/staff");

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ status: "Fail", message: "No token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const staffVerify = await STAFF.findById(decoded.id)
    if (!staffVerify) {
      return res.status(401).json({ status: "Fail", message: "Invalid token" });
    }
    req.user = staffVerify;
    next();
  } catch (err) {
    res.status(401).json({ status: "Fail", message: "Invalid token" });
  }
}

module.exports = authMiddleware;
