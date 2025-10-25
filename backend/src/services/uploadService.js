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
const filename = path.basename(file.filename || file.path);

return {
url: filename, 
provider: "local",
fileName: file.originalname,
fileType: file.mimetype,
};
}
};

exports.deleteFile = async (filePath, extra = {}) => {
if (!filePath) return;
if (useCloudinary) {
try {
if (extra.public_id) {
await cloudinary.uploader.destroy(extra.public_id, { resource_type: "raw" });
return;
}

if (filePath.startsWith('http')) {
const parsed = filePath.split("/").pop();
const publicId = parsed.split(".")[0];
const cloudPath = `sgms_attachments/${publicId}`;
await cloudinary.uploader.destroy(cloudPath, { resource_type: "raw" });
} else {
const cloudPath = `sgms_attachments/${filePath.split('.')[0]}`;
await cloudinary.uploader.destroy(cloudPath, { resource_type: "raw" });
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
