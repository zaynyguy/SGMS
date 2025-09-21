// src/components/BottomSheet.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * BottomSheet
 * - Renders into document.body via createPortal so it always overlays the page
 * - Prevents body scroll while open
 * - ESC to close
 * - Swipe-down-to-close (touch)
 * - Accessible role="dialog" aria-modal="true"
 *
 * Usage:
 *  <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
 *    ...content...
 *  </BottomSheet>
 */

export default function BottomSheet({ open, onClose, children, height = "66vh" }) {
  const sheetRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const draggingRef = useRef(false);

  // create a DOM node for the portal (keeps markup tidy)
  const portalRootRef = useRef(null);
  if (portalRootRef.current === null && typeof document !== "undefined") {
    portalRootRef.current = document.createElement("div");
    portalRootRef.current.className = "notification-bottom-sheet-portal";
  }

  // mount / unmount portal root
  useEffect(() => {
    const root = portalRootRef.current;
    if (!root) return;
    document.body.appendChild(root);
    return () => {
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }, []);

  // lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // touch handling (swipe down to dismiss)
  const onTouchStart = (e) => {
    draggingRef.current = true;
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    if (sheetRef.current) sheetRef.current.style.transition = ""; // disable transition while dragging
  };

  const onTouchMove = (e) => {
    if (!draggingRef.current) return;
    currentY.current = e.touches[0].clientY;
    const delta = Math.max(0, currentY.current - startY.current);
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${delta}px)`;
  };

  const onTouchEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (!sheetRef.current) return;
    sheetRef.current.style.transition = "transform 250ms ease";
    const delta = currentY.current - startY.current;
    const threshold = Math.min(120, window.innerHeight * 0.18); // close threshold
    if (delta > threshold) {
      sheetRef.current.style.transform = `translateY(100%)`;
      // wait for animation then close
      setTimeout(() => {
        if (typeof onClose === "function") onClose();
        // reset transform for next open
        if (sheetRef.current) sheetRef.current.style.transform = "";
      }, 200);
    } else {
      // snap back
      sheetRef.current.style.transform = "translateY(0)";
    }
  };

  // click on backdrop closes
  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // if not open, render nothing (no portal)
  if (!open || !portalRootRef.current) return null;

  // portal content
  const sheet = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
      onClick={onBackdropClick}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        aria-hidden="true"
      />

      {/* Sheet container */}
      <div
        ref={sheetRef}
        className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-lg"
        style={{
          height,
          transform: "translateY(0)",
          transition: "transform 300ms ease, opacity 200ms ease",
          touchAction: "none", // allow custom touch handling
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* drag handle */}
        <div className="w-full flex justify-center py-2">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
        </div>

        {/* content area */}
        <div className="overflow-auto h-[calc(100%-24px)]">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, portalRootRef.current);
}
