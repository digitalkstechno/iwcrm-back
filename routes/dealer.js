var express = require("express");
var router = express.Router();
let {
  createDealer,
  fetchAllDealers,
  fetchDealerById,
  dealerUpdate,
  dealerDelete,
} = require("../controller/dealer");
const authMiddleware = require("../middleware/auth");

router.post("/create", authMiddleware, createDealer);
router.get("/", authMiddleware, fetchAllDealers);
router.get("/:id", authMiddleware, fetchDealerById);
router.put("/:id", authMiddleware, dealerUpdate);
router.delete("/:id", authMiddleware, dealerDelete);

module.exports = router;
