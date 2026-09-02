const express = require("express");
const router = express.Router();
const { leadCreate, leadList, leadListById, leadUpdate, leadDelete } = require("../controller/lead");

router.post("/create", leadCreate);
router.get("/", leadList);
router.get("/:id", leadListById);
router.put("/:id", leadUpdate);
router.delete("/:id", leadDelete);

module.exports = router;
