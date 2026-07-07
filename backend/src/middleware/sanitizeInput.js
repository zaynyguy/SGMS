// src/middleware/sanitizeInput.js

/**
 * Escape HTML special characters to prevent XSS attacks
 */
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Recursively sanitize input by trimming and escaping HTML
 */
function normalizeValue(value) {
  if (typeof value === "string") {
    // Trim and escape HTML to prevent XSS
    return escapeHtml(value.trim());
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value).reduce((normalized, key) => {
      normalized[key] = normalizeValue(value[key]);
      return normalized;
    }, {});
  }

  return value;
}

function sanitizeInput(req, res, next) {
  try {
    req.body = normalizeValue(req.body || {});
    req.query = normalizeValue(req.query || {});
    req.params = normalizeValue(req.params || {});
  } catch (err) {
    console.error("Sanitization error:", err);
    return res.status(400).json({ message: "Invalid input format" });
  }
  next();
}

module.exports = { sanitizeInput };
