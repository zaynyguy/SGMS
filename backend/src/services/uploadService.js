const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");

const useCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

exports.uploadFile = async (file) => {
  if (!file) throw new Error("No file uploaded");

  if (useCloudinary) {
    const res = await cloudinary.uploader.upload(file.path, {
      folder: "sgms_attachments",
    });
    try {
      fs.unlinkSync(file.path);
    } catch (e) {}
    return {
      url: res.secure_url,
      provider: "cloudinary",
      fileName: file.originalname,
      fileType: file.mimetype,
    };
  } else {
    const filename = path.basename(file.filename);
    const localUrl = `/uploads/${filename}`;
    return {
      url: localUrl,
      provider: "local",
      fileName: file.originalname,
      fileType: file.mimetype,
    };
  }
};
