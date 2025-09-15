// src/services/uploadService.js
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

/**
 * Upload a file (local or Cloudinary). Returns { url, provider, fileName, fileType, public_id? }
 */
exports.uploadFile = async (file) => {
  if (!file) throw new Error("No file uploaded");

  if (useCloudinary) {
    // use resource_type=raw so docx/pdf/zip/xlsx all work
    const res = await cloudinary.uploader.upload(file.path, {
      folder: "sgms_attachments",
      resource_type: "raw",
    });

    // remove temp file
    try { fs.unlinkSync(file.path); } catch (e) {}

    // capture public_id for later deletes
    return {
      url: res.secure_url,
      provider: "cloudinary",
      fileName: file.originalname,
      fileType: file.mimetype,
      public_id: res.public_id || null,
    };
  } else {
    // local storage: multer already wrote to UPLOAD_DIR
    const filename = path.basename(file.filename || file.path);
    const localUrl = `/uploads/${filename}`;
    return {
      url: localUrl,
      provider: "local",
      fileName: file.originalname,
      fileType: file.mimetype,
    };
  }
};

/**
 * Delete a file either from Cloudinary or local uploads folder.
 * Accepts the stored filePath (value from DB).
 */
exports.deleteFile = async (filePath, extra = {}) => {
  // filePath should be either a cloudinary URL or a local URL (/uploads/filename)
  if (!filePath) return;
  if (useCloudinary) {
    try {
      // prefer public_id if caller passed it in extra.public_id
      if (extra.public_id) {
        await cloudinary.uploader.destroy(extra.public_id, { resource_type: "raw" });
        return;
      }
      // fallback: derive public id from URL (crude but often works)
      const parsed = filePath.split("/").pop(); // filename.ext or public_id
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
      // ignore
      console.error("Local delete failed:", err);
    }
  }
};
