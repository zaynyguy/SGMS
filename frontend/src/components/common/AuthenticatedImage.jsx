// src/components/common/AuthenticatedImage.jsx
import React, { useEffect, useRef, useState } from "react";
import { rawFetch } from "../../api/auth";
import { User } from "lucide-react";

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

const imageCache = new Map();
const MAX_CACHE_ENTRIES = 50;

function cacheSet(key, value) {
  if (imageCache.has(key)) imageCache.delete(key);
  imageCache.set(key, value);
  while (imageCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = imageCache.keys().next().value;
    const oldestUrl = imageCache.get(oldestKey);
    imageCache.delete(oldestKey);
    try {
      if (oldestUrl) URL.revokeObjectURL(oldestUrl);
    } catch (e) {}
  }
}

function clearImageCache() {
  for (const url of imageCache.values()) {
    try { URL.revokeObjectURL(url); } catch (e) {}
  }
  imageCache.clear();
}

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
  const [objectUrl, setObjectUrl] = useState(() => (imageCache.has(src) ? imageCache.get(src) : null));
  const [status, setStatus] = useState(() => (imageCache.has(src) ? "loaded" : "loading"));
  const objectUrlRef = useRef(null);

  useEffect(() => {
    if (imageCache.has(src)) {
      const cached = imageCache.get(src);
      try { cacheSet(src, cached); } catch (e) {}
      setObjectUrl(cached);
      setStatus("loaded");
      return;
    }

    if (objectUrlRef.current && !Array.from(imageCache.values()).includes(objectUrlRef.current)) {
      try { URL.revokeObjectURL(objectUrlRef.current); } catch (e) {}
      objectUrlRef.current = null;
    }
    setObjectUrl(null);

    if (!src) {
      setStatus("error");
      return;
    }

    if (src.startsWith("blob:") || src.startsWith("data:")) {
      setObjectUrl(src);
      setStatus("loaded");
      return;
    }

    let isCancelled = false;
    setStatus("loading");

    const fetchImage = async () => {
      try {
        const response = await rawFetch(src, "GET");
        if (isCancelled) return;
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
        const blob = await response.blob();
        if (isCancelled) return;
        if (!blob.type.startsWith("image/")) throw new Error("Resource is not an image");
        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        try { cacheSet(src, url); } catch (e) {}
        setObjectUrl(url);
        setStatus("loaded");
      } catch (error) {
        if (!isCancelled) setStatus("error");
      }
    };

    fetchImage();

    return () => {
      isCancelled = true;
      if (objectUrlRef.current && !Array.from(imageCache.values()).includes(objectUrlRef.current)) {
        try { URL.revokeObjectURL(objectUrlRef.current); } catch (e) {}
        objectUrlRef.current = null;
      }
    };
  }, [src]);

  const initials = initialsFromName(fallbackName, fallbackUsername);
  const gradient = gradientFromString(fallbackSeed || fallbackName || fallbackUsername);

  return (
    <div
      className={`relative inline-block ${fallbackClassName || className}`}
      aria-label={alt}
      title={alt}
      style={{ overflow: "hidden", background: gradient }}
    >
      {objectUrl && (
        <img
          src={objectUrl}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-150 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      )}
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${status === "loaded" ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
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
