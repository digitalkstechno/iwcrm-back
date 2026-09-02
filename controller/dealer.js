const {
  createDealerService,
  fetchAllDealersService,
  fetchDealerByIdService,
  dealerUpdateService,
  dealerDeleteService,
} = require("../service/dealer");

exports.createDealer = async (req, res) => {
  try {
    const dealerDetails = await createDealerService(req.body);
    return res.status(201).json({ status: "Success", message: "Dealer created successfully", data: dealerDetails });
  } catch (error) {
    return res.status(400).json({ status: "Fail", message: error.message });
  }
};

exports.fetchAllDealers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const { totalDealer, dealersData } = await fetchAllDealersService({ page, limit, search });
    return res.status(200).json({
      status: "Success",
      message: "Dealers fetched successfully",
      pagination: { totalRecords: totalDealer, currentPage: page, totalPages: Math.ceil(totalDealer / limit), limit },
      data: dealersData,
    });
  } catch (error) {
    return res.status(500).json({ status: "Fail", message: error.message });
  }
};

exports.fetchDealerById = async (req, res) => {
  try {
    const dealerData = await fetchDealerByIdService(req.params.id);
    return res.status(200).json({ status: "Success", message: "Dealer fetched successfully", data: dealerData });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

exports.dealerUpdate = async (req, res) => {
  try {
    const updatedDealer = await dealerUpdateService(req.params.id, req.body);
    return res.status(200).json({ status: "Success", message: "Dealer updated successfully", data: updatedDealer });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

exports.dealerDelete = async (req, res) => {
  try {
    await dealerDeleteService(req.params.id);
    return res.status(200).json({ status: "Success", message: "Dealer deleted successfully" });
  } catch (error) {
    return res.status(404).json({ status: "Fail", message: error.message });
  }
};

