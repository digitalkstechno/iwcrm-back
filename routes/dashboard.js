const express = require("express");
const router = express.Router();
const { getDashboardStats } = require("../controller/dashboard");

router.get("/", getDashboardStats);

module.exports = router;
