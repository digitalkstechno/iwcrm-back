const CryptoJS = require("crypto-js");

const SECRET_KEY = process.env.CRYPTO_SECRET_KEY;

/**
 * Encrypt any data (string / object)
 */
const encryptData = (data) => {
  if (!data) return null;

  const text =
    typeof data === "string" ? data : JSON.stringify(data);

  return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
};

/**
 * Decrypt encrypted string
 */
const decryptData = (encryptedData) => {
  if (!encryptedData) return null;

  const bytes = CryptoJS.AES.decrypt(encryptedData, SECRET_KEY);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);

  try {
    return JSON.parse(decrypted); // if JSON
  } catch (err) {
    return decrypted; // if normal string
  }
};

module.exports = {
  encryptData,
  decryptData,
};
