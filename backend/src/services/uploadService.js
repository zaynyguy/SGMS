// src/services/uploadService.js
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { UPLOAD_DIR } = require("../middleware/uploadMiddleware");

// Detect cloudinary usage
const useCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

// Determine backend base URL for local uploads
// e.g. http://localhost:5000 or https://yourdomain.com
const BASE_URL =
  process.env.PUBLIC_BACKEND_URL ||
  `http://localhost:${process.env.PORT || 5000}`;

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Upload a file (local or Cloudinary). Returns { url, provider, fileName, fileType, public_id? }
 */
exports.uploadFile = async (file) => {
  if (!file) throw new Error("No file uploaded");

  if (useCloudinary) {
    // Cloud upload
    const res = await cloudinary.uploader.upload(file.path, {
      folder: "sgms_attachments",
      resource_type: "raw",
    });

    try { fs.unlinkSync(file.path); } catch (e) {}

    return {
      url: res.secure_url,
      provider: "cloudinary",
      fileName: file.originalname,
      fileType: file.mimetype,
      public_id: res.public_id || null,
    };
  } else {
    // Local storage
    const filename = path.basename(file.filename || file.path);
    const relativePath = `/uploads/${filename}`;

    // 🔥 Make URL absolute using backend's base URL
    const absoluteUrl = `${BASE_URL}${relativePath}`;

    return {
      url: absoluteUrl,
      provider: "local",
      fileName: file.originalname,
      fileType: file.mimetype,
    };
  }
};

/**
 * Delete a file either from Cloudinary or local uploads folder.
 */
exports.deleteFile = async (filePath, extra = {}) => {
  if (!filePath) return;
  if (useCloudinary) {
    try {
      if (extra.public_id) {
        await cloudinary.uploader.destroy(extra.public_id, { resource_type: "raw" });
        return;
      }
      const parsed = filePath.split("/").pop();
      const publicId = parsed.split(".")[0];
      const cloudPath = `sgms_attachments/${publicId}`;
      await cloudinary.uploader.destroy(cloudPath, { resource_type: "raw" });
    } catch (err) {
      console.error("Cloudinary delete failed:", err);
    }
  } else {
    try {
      const fullPath = path.join(UPLOAD_DIR, path.basename(filePath));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (err) {
      console.error("Local delete failed:", err);
    }
  }
};
