// src/components/AllowedTypesInput.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

/* --- helpers (same as before) --- */
const EXT_TO_MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  mp4: "video/mp4",
  zip: "application/zip",
  svg: "image/svg+xml",
};

const COMMON_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "text/plain",
  "text/csv",
  "application/zip",
  "image/*",
  "video/*",
];

function normalizeMime(input) {
  if (!input) return "";
  let v = input.trim().toLowerCase();
  if (v.startsWith(".")) v = v.slice(1);
  if (!v.includes("/")) {
    if (EXT_TO_MIME[v]) return EXT_TO_MIME[v];
    return v;
  }
  return v;
}

function isValidMime(v) {
  if (typeof v !== "string") return false;
  return /^[a-z0-9.+-]+\/(\*|[a-z0-9.+-]+)$/i.test(v.trim());
}

// shallow array equality (order matters)
function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export default function AllowedTypesInput({ value = [], onChange, placeholder }) {
  const [items, setItems] = useState(Array.isArray(value) ? value : []);
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [highlight, setHighlight] = useState(-1); // keyboard nav index

  const inputRef = useRef();
  const containerRef = useRef();
  const initialMountRef = useRef(true);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // keep items in sync if parent changes `value`
  useEffect(() => {
    const next = Array.isArray(value) ? value : [];
    if (!arraysEqual(next, items)) setItems(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // notify parent when items change (skip initial mount)
  useEffect(() => {
    const bad = items.filter((i) => !isValidMime(i));
    setError(bad.length ? `Invalid MIME types: ${bad.join(", ")}` : "");

    if (initialMountRef.current) { initialMountRef.current = false; return; }
    if (onChangeRef.current) onChangeRef.current(items);
  }, [items]);

  // build suggestion list (exclude already selected)
  const suggestions = useMemo(() => {
    const lower = input.trim().toLowerCase();
    const all = [
      ...COMMON_TYPES.map((t) => ({ type: "mime", label: t, value: t })),
      ...Object.entries(EXT_TO_MIME).map(([ext, mime]) => ({ type: "ext", label: `.${ext} → ${mime}`, value: mime, ext })),
    ];
    return all
      .filter((s) => !items.includes(s.value))
      .filter((s) => {
        if (!lower) return true;
        return s.value.toLowerCase().includes(lower) || (s.ext && s.ext.includes(lower));
      });
  }, [input, items]);

  const addRaw = useCallback((raw) => {
    if (!raw) return;
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean);
    const next = Array.isArray(items) ? [...items] : [];
    parts.forEach((p) => {
      const norm = normalizeMime(p);
      if (!norm) return;
      if (!next.includes(norm)) next.push(norm);
    });
    setItems(next);
    setInput("");
    setShowSuggestions(false);
    setHighlight(-1);
  }, [items]);

  function removeAt(i) {
    const copy = items.slice();
    copy.splice(i, 1);
    setItems(copy);
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    addRaw(text);
  }

  function openSuggestions() {
    setShowSuggestions(true);
    setHighlight(-1);
  }

  function closeSuggestions() {
    setShowSuggestions(false);
    setHighlight(-1);
  }

  function selectSuggestionByIndex(idx) {
    const s = suggestions[idx];
    if (!s) return;
    addRaw(s.value);
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showSuggestions) { openSuggestions(); return; }
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showSuggestions && highlight >= 0) {
        selectSuggestionByIndex(highlight);
      } else {
        addRaw(input);
      }
    } else if (e.key === "Escape") {
      closeSuggestions();
    } else if (e.key === "Backspace" && input === "" && items.length) {
      setItems(items.slice(0, -1));
    } else if (e.key === "," || e.key === " ") {
      if (input.trim()) {
        e.preventDefault();
        addRaw(input);
      }
    }
  }

  // close suggestions when clicking outside — but BEFORE closing, commit typed input (if any)
  useEffect(() => {
    function onDocClick(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) {
        // commit typed value before closing (use DOM value to avoid stale closure)
        const domVal = inputRef.current?.value ?? "";
        if (domVal.trim()) {
          addRaw(domVal);
        } else {
          closeSuggestions();
        }
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [addRaw]); // re-register if addRaw identity changes

  return (
    <div ref={containerRef} className="w-full relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allowed Attachment Types</label>

      <div
        className="min-h-[56px] border rounded-lg px-2 py-1 bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-600"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {items.map((it, idx) => (
            <div key={it + idx} className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-800/40 border border-blue-100 dark:border-blue-700 px-2 py-1 rounded-full text-sm">
              <span className="text-xs text-gray-700 dark:text-gray-100">{it}</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label={`Remove ${it}`}
                className="text-xs leading-none p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>
          ))}

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); setHighlight(-1); }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => openSuggestions()}
            onBlur={() => {
              // give mouse selection a moment — if user clicked a suggestion, mouseDown handlers will run first
              setTimeout(() => {
                const domVal = inputRef.current?.value ?? "";
                if (domVal.trim()) addRaw(domVal);
                else closeSuggestions();
              }, 150);
            }}
            placeholder={placeholder}
            className="flex-1 min-w-[120px] px-1 py-2 bg-transparent outline-none text-sm text-gray-900 dark:text-white"
            aria-label="Add mime type"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            aria-controls="allowed-types-listbox"
          />
        </div>

        <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">
          <div>Examples: <code className="text-xs">application/pdf</code>, <code className="text-xs">image/png</code>, <code className="text-xs">image/*</code></div>
          {error ? <div className="mt-1 text-red-600 dark:text-red-400">{error}</div> : null}
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          id="allowed-types-listbox"
          role="listbox"
          aria-label="Suggested attachment types"
          className="absolute left-0 right-0 mt-1 border rounded bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 shadow-sm z-30 max-h-56 overflow-auto"
        >
          <div className="p-2">
            {suggestions.map((s, i) => {
              const active = i === highlight;
              return (
                <button
                  key={s.value + i}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestionByIndex(i); }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`w-full text-left px-3 py-2 rounded ${active ? "bg-gray-100 dark:bg-gray-600" : "hover:bg-gray-50 dark:hover:bg-gray-600"}`}
                >
                  <div className="text-sm">{s.value}</div>
                  {s.type === "ext" && <div className="text-xs text-gray-500 dark:text-gray-400">.{s.ext}</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
