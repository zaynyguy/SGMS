// src/services/uploadService.js
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { UPLOAD_DIR, CLOUDINARY_ENABLED } = require("../middleware/uploadMiddleware");

if (CLOUDINARY_ENABLED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

exports.uploadFile = async (file) => {
  if (!file) throw new Error("No file uploaded");

  if (CLOUDINARY_ENABLED) {
    try {
      // ✅ Critical: set filename_override to preserve Amharic name
      const res = await cloudinary.uploader.upload(file.path, {
        folder: "sgms_attachments",
        resource_type: "auto",
        unique_filename: false,
        filename_override: file.originalname, // ← ← ← PRESERVES UTF-8 NAME
        overwrite: false,
        invalidate: true,
      });

      try { fs.unlinkSync(file.path); } catch {}

      return {
        url: res.secure_url,
        provider: "cloudinary",
        fileName: file.originalname, // ← ← ← stored as-is in DB
        fileType: file.mimetype,
        publicId: res.public_id || null,
      };
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      throw err;
    }
  } else {
    // Local: already preserved in middleware
    const filename = path.basename(file.path);
    return {
      url: filename,
      provider: "local",
      fileName: file.originalname, // ← ← ← original Unicode name
      fileType: file.mimetype,
    };
  }
};

exports.deleteFile = async (filePath, extra = {}) => {
  if (!filePath) return;

  if (CLOUDINARY_ENABLED) {
    try {
      if (extra.publicId) {
        await cloudinary.uploader.destroy(extra.publicId, { resource_type: "auto" });
        return;
      }

      // Fallback: extract public ID from URL
      if (filePath.startsWith("http")) {
        const url = new URL(filePath);
        const parts = url.pathname.split("/").filter(Boolean);
        const publicId = parts.slice(2).join("/"); // skip /v123456789/
        await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
      } else {
        // Local path fallback
        const publicId = `sgms_attachments/${path.basename(filePath, path.extname(filePath))}`;
        await cloudinary.uploader.destroy(publicId, { resource_type: "auto" });
      }
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