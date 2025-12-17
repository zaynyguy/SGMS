import React, { useState, useEffect, useRef } from "react";
import { rawFetch } from "../../api/auth"; // Import rawFetch for authenticated requests
import { User } from "lucide-react"; // Using User icon as a generic fallback

/* ---------- Helpers (copied from your files) ---------- */
const initialsFromName = (name, fallback) => {
  const n = (name || "").trim();
  if (!n) {
    const u = (fallback || "").trim();
    return (u[0] || "?").toUpperCase();
  }
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const gradientFromString = (s) => {
  let hash = 0;
  for (let i = 0; i < (s || "").length; i += 1)
    hash = (hash << 5) - hash + s.charCodeAt(i);
  const a = Math.abs(hash);
  const h1 = a % 360;
  const h2 = (180 + h1) % 360;
  return `linear-gradient(135deg, hsl(${h1} 70% 60%), hsl(${h2} 70% 40%))`;
};
/* --------------------------------------------------- */

/**
 * An image component that fetches its source using an authenticated request.
 * It handles loading, error, and fallback states (initials/gradient).
 *
 * @param {string} src - The secure, absolute URL to the image (e.g., http://.../api/users/profile-picture/...)
 * @param {string} alt - Alt text for the image.
 * @param {string} [className] - Tailwind classes for the <img> tag.
 * @param {string} [fallbackName] - The name to use for generating initials (e.g., user.name).
 * @param {string} [fallbackUsername] - The username to use if name is not provided (e.g., user.username).
 * @param {string} [fallbackSeed] - A string to seed the gradient (e.g., user.name or user.id).
 * @param {string} [fallbackClassName] - Tailwind classes for the fallback <div> (initials/gradient).
 */
// Simple in-memory cache for fetched image object URLs to avoid
// refetching when the component unmounts and remounts with the same src.
// Implement a small LRU-like eviction to prevent unbounded memory growth.
const imageCache = new Map(); // src -> objectUrl
const MAX_CACHE_ENTRIES = 50;

function cacheSet(key, value) {
  // Ensure most-recently-set keys are at the end of Map insertion order
  if (imageCache.has(key)) imageCache.delete(key);
  imageCache.set(key, value);

  // Evict oldest entries if we're over the cap
  while (imageCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    const oldestUrl = imageCache.get(oldestKey);
    imageCache.delete(oldestKey);
    try {
      // Revoke the object URL for the evicted entry to free memory
      if (oldestUrl) URL.revokeObjectURL(oldestUrl);
    } catch (e) {
      /* ignore revocation errors */
    }
  }
}

function clearImageCache() {
  for (const url of imageCache.values()) {
    try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
  }
  imageCache.clear();
}

// Optionally clear cache on page unload to release memory for long-lived sessions
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", clearImageCache);
}

const AuthenticatedImage = ({
  src,
  alt,
  className = "w-10 h-10 rounded-full object-cover",
  fallbackName = "",
  fallbackUsername = "",
  fallbackSeed = "user",
  fallbackClassName = "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
}) => {
  // Initialize state from cache when possible to avoid an intermediate fallback render
  const [objectUrl, setObjectUrl] = useState(() => (imageCache.has(src) ? imageCache.get(src) : null));
  const [status, setStatus] = useState(() => (imageCache.has(src) ? "loaded" : "loading")); // 'loading', 'loaded', 'error'
  const objectUrlRef = useRef(null); // To store the URL for revocation

  useEffect(() => {
    // If we have a cached object URL for this src, reuse it and skip fetch
    if (imageCache.has(src)) {
      const cached = imageCache.get(src);
      // When reusing, move to the end of insertion order to mark as recently used
      try { cacheSet(src, cached); } catch (e) { /* ignore */ }
      setObjectUrl(cached);
      setStatus("loaded");
      return;
    }
    // Cleanup previous object URL if it wasn't cached
    if (objectUrlRef.current && !Array.from(imageCache.values()).includes(objectUrlRef.current)) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setObjectUrl(null);
    
    if (!src || !src.startsWith("http")) {
      setStatus("error"); // Not a valid URL to fetch
      return;
    }

    let isCancelled = false;
    setStatus("loading");

    const fetchImage = async () => {
      try {
        // Use rawFetch to include the Authorization header
        const response = await rawFetch(src, "GET");
        
        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();
        if (isCancelled) return;

        // Check if blob is a valid image type, otherwise treat as error
        if (!blob.type.startsWith("image/")) {
            console.error("Fetched resource is not an image:", blob.type);
            throw new Error("Resource is not an image");
        }

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url; // Store for cleanup
        // Cache the object URL so future mounts can reuse it (LRU-set)
        try { cacheSet(src, url); } catch (e) { /* ignore cache errors */ }
        setObjectUrl(url);
        setStatus("loaded");
      } catch (error) {
        console.error("AuthenticatedImage fetch error:", error);
        if (!isCancelled) {
          setStatus("error");
        }
      }
    };

    fetchImage();

    // Cleanup function
    return () => {
      isCancelled = true;
      // Only revoke if this objectUrl isn't cached (others may still use it)
      if (objectUrlRef.current && !Array.from(imageCache.values()).includes(objectUrlRef.current)) {
        try { URL.revokeObjectURL(objectUrlRef.current); } catch (e) { /* ignore */ }
        objectUrlRef.current = null;
      }
    };
  }, [src]); // Re-run whenever the src URL changes

  // Prepare fallback content
  const initials = initialsFromName(fallbackName, fallbackUsername);
  const gradient = gradientFromString(fallbackSeed || fallbackName || fallbackUsername);

  // Render both the fallback and the image in the same container so we can
  // crossfade between them instead of unmounting/remounting nodes.
  return (
    <div
      className={`relative inline-block ${fallbackClassName || className}`}
      aria-label={alt}
      title={alt}
      style={{ overflow: "hidden", background: gradient }}
    >
      {/* Image (absolutely positioned to cover the container) */}
      {objectUrl && (
        <img
          src={objectUrl}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${
            status === "loaded" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Fallback (initials or icon) */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
          status === "loaded" ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        {initials ? (
          <span className="text-lg font-semibold text-white">{initials}</span>
        ) : (
          <User className="w-1/2 h-1/2 opacity-80 text-white" />
        )}
      </div>
    </div>
  );
};

export default AuthenticatedImage;
