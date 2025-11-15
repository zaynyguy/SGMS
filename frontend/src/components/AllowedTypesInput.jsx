// src/components/AllowedTypesInput.jsx
import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";

// Chevron icons component
const ChevronIcon = ({ isOpen, className = "" }) => (
  <svg
    className={`w-4 h-4 transition-transform duration-200 ${className} ${
      isOpen ? "rotate-180" : ""
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

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

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Custom hook for dropdown state management
function useDropdownState() {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const open = useCallback(() => {
    setIsOpen(true);
    setHighlightIndex(-1);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightIndex(-1);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
    setHighlightIndex(-1);
  }, []);

  return {
    isOpen,
    highlightIndex,
    setHighlightIndex,
    open,
    close,
    toggle,
  };
}

// Custom hook for click outside detection
function useClickOutside(ref, callback) {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [ref, callback]);
}

export default function AllowedTypesInput({ value = [], onChange, placeholder }) {
  const [items, setItems] = useState(Array.isArray(value) ? value : []);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const inputRef = useRef();
  const containerRef = useRef();
  const dropdownRef = useRef();
  const initialMountRef = useRef(true);
  const onChangeRef = useRef(onChange);
  
  const {
    isOpen: showSuggestions,
    highlightIndex: highlight,
    setHighlightIndex: setHighlight,
    open: openSuggestions,
    close: closeSuggestions,
    toggle: toggleSuggestions,
  } = useDropdownState();

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Keep items in sync with parent value
  useEffect(() => {
    const next = Array.isArray(value) ? value : [];
    if (!arraysEqual(next, items)) setItems(next);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent when items change
  useEffect(() => {
    const bad = items.filter((i) => !isValidMime(i));
    setError(bad.length ? `Invalid MIME types: ${bad.join(", ")}` : "");

    if (initialMountRef.current) { 
      initialMountRef.current = false; 
      return; 
    }
    if (onChangeRef.current) onChangeRef.current(items);
  }, [items]);

  // Build suggestions list
  const suggestions = useMemo(() => {
    const lower = input.trim().toLowerCase();
    const all = [
      ...COMMON_TYPES.map((t) => ({ type: "mime", label: t, value: t })),
      ...Object.entries(EXT_TO_MIME).map(([ext, mime]) => ({ 
        type: "ext", 
        label: `.${ext} → ${mime}`, 
        value: mime, 
        ext 
      })),
    ];
    return all
      .filter((s) => !items.includes(s.value))
      .filter((s) => {
        if (!lower) return true;
        return s.value.toLowerCase().includes(lower) || 
               (s.ext && s.ext.includes(lower));
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
    closeSuggestions();
  }, [items, closeSuggestions]);

  const removeItem = useCallback((index) => {
    const copy = items.slice();
    copy.splice(index, 1);
    setItems(copy);
  }, [items]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    addRaw(text);
  }, [addRaw]);

  const selectSuggestion = useCallback((index) => {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    addRaw(suggestion.value);
    inputRef.current?.focus();
  }, [suggestions, addRaw]);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!showSuggestions) {
          openSuggestions();
        } else {
          setHighlight(prev => Math.min(prev + 1, suggestions.length - 1));
        }
        break;

      case "ArrowUp":
        e.preventDefault();
        setHighlight(prev => Math.max(prev - 1, 0));
        break;

      case "Enter":
        e.preventDefault();
        if (showSuggestions && highlight >= 0) {
          selectSuggestion(highlight);
        } else {
          addRaw(input);
        }
        break;

      case "Escape":
        closeSuggestions();
        break;

      case "Backspace":
        if (input === "" && items.length > 0) {
          setItems(items.slice(0, -1));
        }
        break;

      case ",":
      case " ":
        if (input.trim()) {
          e.preventDefault();
          addRaw(input);
        }
        break;

      case "Tab":
        // Close dropdown on tab, but don't prevent default tab behavior
        closeSuggestions();
        break;

      default:
        break;
    }
  }, [
    showSuggestions,
    highlight,
    suggestions.length,
    input,
    items,
    addRaw,
    selectSuggestion,
    openSuggestions,
    closeSuggestions,
    setHighlight
  ]);

  // Close dropdown when clicking outside
  useClickOutside(containerRef, () => {
    if (input.trim()) {
      addRaw(input);
    } else {
      closeSuggestions();
    }
  });

  // Dropdown positioning
  const [dropdownRect, setDropdownRect] = useState(null);
  useLayoutEffect(() => {
    if (!showSuggestions) return;

    function updateRect() {
      const el = containerRef.current;
      if (!el) return setDropdownRect(null);
      const rect = el.getBoundingClientRect();
      setDropdownRect(rect);
    }

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [showSuggestions, input, suggestions.length]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    if (!showSuggestions && e.target.value.trim()) {
      openSuggestions();
    }
    setHighlight(-1);
  }, [showSuggestions, openSuggestions, setHighlight]);

  const handleInputFocus = useCallback(() => {
    openSuggestions();
  }, [openSuggestions]);

  const handleChevronClick = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSuggestions();
    inputRef.current?.focus();
  }, [toggleSuggestions]);

  return (
    <div ref={containerRef} className="w-full relative text-gray-900 dark:text-gray-300">
      <div
        className="min-h-[56px] border rounded-lg px-2 py-1 bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-600 cursor-text transition-colors focus-within:border-blue-500 dark:focus-within:border-blue-400"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-2 items-center">
          {items.map((item, index) => (
            <Tag 
              key={`${item}-${index}`} 
              item={item} 
              onRemove={() => removeItem(index)} 
            />
          ))}

          <div className="flex-1 flex items-center min-w-[120px]">
            <input
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={handleInputFocus}
              placeholder={placeholder}
              className="flex-1 px-1 py-2 bg-transparent outline-none text-sm text-gray-900 dark:text-white min-w-0"
              aria-label="Add MIME type"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-haspopup="listbox"
              aria-controls="allowed-types-listbox"
            />
            
            {/* Chevron toggle button */}
            <button
              type="button"
              onClick={handleChevronClick}
              aria-label={showSuggestions ? "Close suggestions" : "Open suggestions"}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors ml-1 flex-shrink-0"
              tabIndex={-1} // Prevent tab focus on chevron
            >
              <ChevronIcon 
                isOpen={showSuggestions} 
                className="text-gray-500 dark:text-gray-400" 
              />
            </button>
          </div>
        </div>

        <HelpText error={error} />
      </div>

      {/* Dropdown Portal */}
      {showSuggestions && suggestions.length > 0 && dropdownRect && createPortal(
        <Dropdown
          ref={dropdownRef}
          suggestions={suggestions}
          highlightIndex={highlight}
          onSelect={selectSuggestion}
          onHighlight={setHighlight}
          position={dropdownRect}
        />,
        document.body
      )}
    </div>
  );
}

// Subcomponents for better organization
const Tag = ({ item, onRemove }) => (
  <div className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-800/40 border border-blue-100 dark:border-blue-700 px-2 py-1 rounded-full text-sm">
    <span className="text-xs text-gray-700 dark:text-gray-100">{item}</span>
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove ${item}`}
      className="text-xs leading-none p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
    >
      ✕
    </button>
  </div>
);

const HelpText = ({ error }) => (
  <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">
    <div>
      Examples:{" "}
      <code className="text-xs">application/pdf</code>,{" "}
      <code className="text-xs">image/png</code>,{" "}
      <code className="text-xs">image/jpeg</code>,{" "}
      <code className="text-xs">application/doc</code>
    </div>
    {error && (
      <div className="mt-1 text-red-600 dark:text-red-400">{error}</div>
    )}
  </div>
);

const Dropdown = React.forwardRef(({ 
  suggestions, 
  highlightIndex, 
  onSelect, 
  onHighlight, 
  position 
}, ref) => (
  <div
    ref={ref}
    id="allowed-types-listbox"
    role="listbox"
    aria-label="Suggested attachment types"
    style={{
      position: "absolute",
      top: position.bottom + window.scrollY,
      left: position.left + window.scrollX,
      width: position.width,
      zIndex: 2147483647,
    }}
    className="border rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-white border-gray-200 dark:border-gray-600 shadow-lg max-h-56 overflow-auto"
  >
    <div className="p-2">
      {suggestions.map((suggestion, index) => (
        <SuggestionItem
          key={`${suggestion.value}-${index}`}
          suggestion={suggestion}
          isHighlighted={index === highlightIndex}
          onSelect={() => onSelect(index)}
          onMouseEnter={() => onHighlight(index)}
        />
      ))}
    </div>
  </div>
));

const SuggestionItem = ({ suggestion, isHighlighted, onSelect, onMouseEnter }) => (
  <button
    type="button"
    role="option"
    aria-selected={isHighlighted}
    onMouseDown={onSelect}
    onMouseEnter={onMouseEnter}
    className={`w-full text-left px-3 py-2 rounded transition-colors ${
      isHighlighted 
        ? "bg-blue-100 dark:bg-blue-600 text-blue-900 dark:text-white" 
        : "hover:bg-gray-50 dark:hover:bg-gray-600"
    }`}
  >
    <div className="text-sm font-medium">{suggestion.value}</div>
    {suggestion.type === "ext" && (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        .{suggestion.ext}
      </div>
    )}
  </button>
);