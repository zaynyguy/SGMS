const API_BASE = import.meta.env.VITE_API_URL || "";
const resolveApiBase = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `http://${url}`;
};
const EFFECTIVE_API_BASE = resolveApiBase(API_BASE || "");
const normalizeUrl = (url) => {
  if (!url) return "/";
  if (url.startsWith("http")) return url;
  return url.startsWith("/") ? url : `/${url}`;
};

export const authService = {
  async login(credentials) {
    try {
      const response = await fetch(
        `${EFFECTIVE_API_BASE}${normalizeUrl("/api/auth/login")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        },
      );

      // Handle non-JSON responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(text || "Invalid server response");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      return data;
    } catch (error) {
      console.error("Login error:", error);
      throw new Error(error.message || "Could not connect to server");
    }
  },

  // Add other auth methods here (logout, register, etc.)
};
