const multer = require("multer");
const path = require("path");
const fs = require("fs");
function createUploader(relativePath) {
  const uploadPath = path.join(__dirname, "..", "public", relativePath);

  // folder exist check
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix =
        Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(
        null,
        file.fieldname +
          "-" +
          uniqueSuffix +
          path.extname(file.originalname)
      );
    },
  });

  return multer({ storage });
}

module.exports = createUploader;
