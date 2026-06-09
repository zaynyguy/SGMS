// src/middleware/sanitizeInput.js

function normalizeValue(value) {
  if (typeof value === "string") {
    return value.trim();
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
  req.body = normalizeValue(req.body);
  req.query = normalizeValue(req.query);
  req.params = normalizeValue(req.params);
  next();
}

module.exports = { sanitizeInput };
