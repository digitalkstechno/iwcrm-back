const DEALER = require("../model/dealer");

exports.createDealerService = async (data) => {
  const dealerDetails = await DEALER.create(data);
  return dealerDetails;
};

exports.fetchAllDealersService = async ({ page, limit, search }) => {
  const skip = (page - 1) * limit;
  const query = {};
  if (search) {
    query.$or = [
      { DealerName: { $regex: search, $options: "i" } },
      { Phone: { $regex: search, $options: "i" } },
      { Email: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { status: { $regex: search, $options: "i" } },
    ];
  }
  const totalDealer = await DEALER.countDocuments(query);
  const dealersData = await DEALER.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
  return { totalDealer, dealersData, page, limit };
};

exports.fetchDealerByIdService = async (dealerId) => {
  const dealerData = await DEALER.findById(dealerId);
  if (!dealerData) throw new Error("Dealer not found");
  return dealerData;
};

exports.dealerUpdateService = async (dealerId, body) => {
  const oldDealer = await DEALER.findById(dealerId);
  if (!oldDealer) throw new Error("Dealer not found");
  const updatedDealer = await DEALER.findByIdAndUpdate(dealerId, body, { new: true });
  return updatedDealer;
};

exports.dealerDeleteService = async (dealerId) => {
  const oldDealer = await DEALER.findById(dealerId);
  if (!oldDealer) throw new Error("Dealer not found");
  await DEALER.findByIdAndDelete(dealerId);
};
