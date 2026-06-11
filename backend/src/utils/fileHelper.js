const path = require("path");

const PUBLIC_BACKEND_URL = process.env.PUBLIC_BACKEND_URL || "";

/**
 * Prefixes a local filename with the correct API path.
 * If the path is already a full URL (e.g., Cloudinary), it returns it as-is.
 * @param {string} filePath - The stored path/filename (e.g., "12345.png" or "https://...")
 * @param {'user' | 'group'} type - The type of profile picture
 * @returns {string | null} - The full, accessible URL (e.g., "http://localhost:5000/api/users/profile-picture/12345.png")
 */
exports.buildProfilePictureUrl = (filePath, type = "user") => {
  if (!filePath) {
    return null;
  }

  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  let normalized = String(filePath).replace(/^\/+/, "");
  if (normalized.toLowerCase().startsWith("uploads/")) {
    normalized = normalized.slice("uploads/".length);
  }
  normalized = path.basename(normalized);

  if (type === "user") {
    if (PUBLIC_BACKEND_URL) {
      return `${PUBLIC_BACKEND_URL.replace(/\/+$/, "")}/api/users/profile-picture/${normalized}`;
    }
    return `/api/users/profile-picture/${normalized}`;
  }
  if (type === "group") {
    if (PUBLIC_BACKEND_URL) {
      return `${PUBLIC_BACKEND_URL.replace(/\/+$/, "")}/api/groups/profile-picture/${normalized}`;
    }
    return `/api/groups/profile-picture/${normalized}`;
  }
  return null;
};
