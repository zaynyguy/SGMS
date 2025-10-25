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
const AuthenticatedImage = ({
  src,
  alt,
  className = "w-10 h-10 rounded-full object-cover",
  fallbackName = "",
  fallbackUsername = "",
  fallbackSeed = "user",
  fallbackClassName = "w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold",
}) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [status, setStatus] = useState("loading"); // 'loading', 'loaded', 'error'
  const objectUrlRef = useRef(null); // To store the URL for revocation

  useEffect(() => {
    // Cleanup previous object URL if src changes
    if (objectUrlRef.current) {
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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [src]); // Re-run whenever the src URL changes

  // STATE: Image is successfully loaded
  if (status === "loaded" && objectUrl) {
    return <img src={objectUrl} alt={alt} className={className} />;
  }

  // STATE: Loading or Error
  // Show the fallback (initials/gradient)
  const initials = initialsFromName(fallbackName, fallbackUsername);
  const gradient = gradientFromString(fallbackSeed || fallbackName || fallbackUsername);

  return (
    <div
      className={fallbackClassName || className} // Use fallback class, or default to img class
      style={{ background: gradient }}
      aria-label={alt}
      title={alt}
    >
      {/* Show initials. If no initials, show a generic user icon */}
      {initials ? (
        <span className="text-lg">{initials}</span>
      ) : (
        <User className="w-1/2 h-1/2 opacity-80" />
      )}
    </div>
  );
};

export default AuthenticatedImage;
