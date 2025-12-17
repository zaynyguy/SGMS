// Determine backend base URL for local uploads
// e.g. http://localhost:5000 or https://yourdomain.com
const BASE_URL =
  process.env.PUBLIC_BACKEND_URL ||
  `http://localhost:${process.env.PORT || 5000}`;

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
  // If it's already a full URL (like Cloudinary), return it directly.
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  // If it's a local file, build the full, absolute API URL.
  // Normalize the stored path to avoid accidental leading slashes
  // which produce URLs like "/api/users/profile-picture//uploads/..".
  const normalized = String(filePath).replace(/^\/+/, "");
  if (type === "user") {
    return `${BASE_URL}/api/users/profile-picture/${normalized}`;
  }
  if (type === "group") {
    return `${BASE_URL}/api/groups/profile-picture/${normalized}`;
  }
  return null;
};
