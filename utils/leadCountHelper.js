const LEADSTATUS = require("../model/leadStatus");
const LEADSOURCES = require("../model/leadSources");

exports.incrementCount = async ({ statusId, sourceId }) => {
  if (statusId) {
    await LEADSTATUS.findByIdAndUpdate(
      statusId,
      { $inc: { count: 1 } },
      { new: true },
    );
  }

  if (sourceId) {
    await LEADSOURCES.findByIdAndUpdate(
      sourceId,
      { $inc: { count: 1 } },
      { new: true },
    );
  }
};

exports.decrementCount = async ({ statusId, sourceId }) => {
  if (statusId) {
    await LEADSTATUS.findByIdAndUpdate(
      statusId,
      { $inc: { count: -1 } },
      { new: true },
    );
  }

  if (sourceId) {
    await LEADSOURCES.findByIdAndUpdate(
      sourceId,
      { $inc: { count: -1 } },
      { new: true },
    );
  }
};
