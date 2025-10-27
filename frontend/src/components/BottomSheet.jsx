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
 * - ENHANCED: Added smooth open/close animations with transforms and transitions
 *
 * Usage:
 *  <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
 *    ...content...
 *  </BottomSheet>
 */

export default function BottomSheet({ open, onClose, children, height = "66vh" }) {
  const sheetRef = useRef(null);
  const backdropRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const draggingRef = useRef(false);
  
  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

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

  // Animation management
  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsAnimating(true);
      // Small delay to ensure DOM is updated before animation starts
      requestAnimationFrame(() => {
        if (backdropRef.current && sheetRef.current) {
          backdropRef.current.style.opacity = '1';
          sheetRef.current.style.transform = 'translateY(0)';
          sheetRef.current.style.opacity = '1';
        }
      });
    } else if (isVisible) {
      // Start exit animation
      setIsAnimating(true);
      if (backdropRef.current && sheetRef.current) {
        backdropRef.current.style.opacity = '0';
        sheetRef.current.style.transform = 'translateY(100%)';
        sheetRef.current.style.opacity = '0';
      }
      // Delay unmounting for animation to complete
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, isVisible]);

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

  // Enhanced touch handling (swipe down to dismiss)
  const onTouchStart = (e) => {
    draggingRef.current = true;
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    if (sheetRef.current) {
      sheetRef.current.style.transition = ""; // disable transition while dragging
      sheetRef.current.style.transform = 'translateY(0)'; // reset transform
    }
  };

  const onTouchMove = (e) => {
    if (!draggingRef.current) return;
    currentY.current = e.touches[0].clientY;
    const delta = Math.max(0, currentY.current - startY.current);
    const progress = delta / 200; // Calculate progress for visual feedback
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
      // Add visual feedback during drag
      sheetRef.current.style.opacity = `${1 - progress * 0.5}`;
    }
    // Update backdrop opacity during drag
    if (backdropRef.current) {
      backdropRef.current.style.opacity = `${0.4 - progress * 0.4}`;
    }
  };

  const onTouchEnd = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (!sheetRef.current) return;
    
    sheetRef.current.style.transition = "transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease";
    const delta = currentY.current - startY.current;
    const threshold = Math.min(120, window.innerHeight * 0.18); // close threshold
    
    if (delta > threshold) {
      // Close with animation
      sheetRef.current.style.transform = `translateY(100%)`;
      sheetRef.current.style.opacity = '0';
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '0';
      }
      // wait for animation then close
      setTimeout(() => {
        if (typeof onClose === "function") onClose();
      }, 250);
    } else {
      // Snap back with enhanced animation
      sheetRef.current.style.transform = "translateY(0)";
      sheetRef.current.style.opacity = '1';
      if (backdropRef.current) {
        backdropRef.current.style.opacity = '1';
      }
    }
  };

  // Enhanced click on backdrop closes with animation
  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      // Start close animation
      if (backdropRef.current && sheetRef.current) {
        backdropRef.current.style.opacity = '0';
        sheetRef.current.style.transform = 'translateY(100%)';
        sheetRef.current.style.opacity = '0';
      }
      // Wait for animation then call onClose
      setTimeout(() => {
        onClose();
      }, 250);
    }
  };

  // if not visible and not animating, render nothing (no portal)
  if (!isVisible && !isAnimating) return null;

  // portal content
  const sheet = (
    <>
      <style>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideOutDown {
          to {
            opacity: 0;
            transform: translateY(100%);
          }
        }
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          to { opacity: 0; }
        }
        .backdrop-enter {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .backdrop-exit {
          animation: fadeOut 0.3s ease-in forwards;
        }
        .sheet-enter {
          animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .sheet-exit {
          animation: slideOutDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .drag-handle {
          transition: all 0.3s ease;
        }
        .drag-handle:active {
          transform: scale(0.95);
        }
        .sheet-content {
          transition: transform 0.2s ease;
        }
        .sheet-content:active {
          transform: scale(0.995);
        }
      `}</style>
      
      <div
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
        aria-modal="true"
        role="dialog"
        onClick={onBackdropClick}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Enhanced backdrop with transition */}
        <div
          ref={backdropRef}
          className="absolute inset-0 bg-black/40 transition-all duration-300 ease-out"
          aria-hidden="true"
          style={{
            opacity: 0,
            backdropFilter: 'blur(2px)'
          }}
        />

        {/* Enhanced Sheet container */}
        <div
          ref={sheetRef}
          className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
          style={{
            height,
            transform: "translateY(100%)",
            opacity: 0,
            transition: "transform 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease",
            touchAction: "none", // allow custom touch handling
            maxHeight: '90vh',
            boxShadow: '0 -20px 50px -10px rgba(0, 0, 0, 0.25)'
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Enhanced drag handle */}
          <div className="w-full flex justify-center py-3 cursor-grab active:cursor-grabbing">
            <div 
              className="drag-handle w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full transition-all duration-300 hover:bg-gray-400 dark:hover:bg-gray-500 hover:w-16"
            />
          </div>

          {/* Enhanced content area */}
          <div className="sheet-content overflow-auto h-[calc(100%-52px)] pb-4">
            {children}
          </div>

          {/* Visual feedback for drag state */}
          {draggingRef.current && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-200" />
          )}
        </div>
      </div>
    </>
  );

  return createPortal(sheet, portalRootRef.current);
}