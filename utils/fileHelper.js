const fs = require("fs");
const path = require("path");

/**
 * Delete uploaded file safely
 * @param {string} folderPath - relative path from /public
 * @param {string} fileName - uploaded file name
 */
const deleteUploadedFile = (folderPath, fileName) => {
  if (!fileName) return;

  const filePath = path.join(
    __dirname,
    "..",
    "public",
    folderPath,
    fileName
  );

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

module.exports = {
  deleteUploadedFile,
};
