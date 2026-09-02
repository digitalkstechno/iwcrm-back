var express = require("express");
var router = express.Router();

router.use("/health", require("./health"));
router.use("/staff", require("./staff"));
router.use("/dealer", require("./dealer"));
router.use("/lead", require("./lead"));

module.exports = router;
