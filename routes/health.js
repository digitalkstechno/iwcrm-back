var express = require("express");
const os = require("os");
var router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "UP",
    server: os.hostname(),
    timestamp: new Date(),
  });
});

module.exports = router;