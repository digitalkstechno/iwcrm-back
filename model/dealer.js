const mongoose = require("mongoose");

const DealerSchema = new mongoose.Schema(
  {
    DealerName: { type: String, required: true },
    Phone: { type: String, required: true },
    Email: { type: String, default: "" },
    city: { type: String, required: true },
    status: { type: String, default: "active" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Dealer", DealerSchema);
