import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, AlignLeft, Tag, Calendar, FolderOpen } from "lucide-react";
import { globalSearch, type SearchResult } from "../lib/db";

const GOLD = "#C9A84C";
const NAVY = "#0D1B2E";
const CARD = "#111D30";
const BORDER = "#1B2A4A";
const MUTED = "#8A9BB5";
const DIM = "#3A4F6A";
const TEXT = "#D0DFEE";

const TYPE_ICONS: Record<SearchResult["type"], React.ReactNode> = {
  file: <FileText size={14} />,
  note: <AlignLeft size={14} />,
  tag: <Tag size={14} />,
  session: <Calendar size={14} />,
  project: <FolderOpen size={14} />,
};

const TYPE_COLORS: Record<SearchResult["type"], string> = {
  file: "#3B82F6",
  note: GOLD,
  tag: "#10B981",
  session: "#F59E0B",
  project: "#06B6D4",
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  file: "File",
  note: "Note",
  tag: "Tag",
  session: "Session",
  project: "Project",
};

interface GlobalSearchProps {
  onNavigate: (type: SearchResult["type"], id: string) => void;
  onClose: () => void;
}

export default function GlobalSearch({ onNavigate, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, results.length - 1));
      if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
      if (e.key === "Enter" && results[selected]) {
        onNavigate(results[selected].type, results[selected].id);
        onClose();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [results, selected, onNavigate, onClose]);

  const runSearch = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    globalSearch(q).then((r) => {
      setResults(r);
      setSelected(0);
      setLoading(false);
    });
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(v), 200);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: BORDER }}>
          <Search size={18} style={{ color: GOLD, flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent outline-none text-base"
            style={{ color: "#FFFFFF", fontSize: "16px" }}
            placeholder="Search files, notes, tags, sessions, projects..."
            value={query}
            onChange={handleChange}
          />
          {loading && (
            <span className="text-xs tracking-widest uppercase" style={{ color: DIM }}>Searching...</span>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: MUTED }}
          >
            <X size={15} />
          </button>
        </div>

        {query && !loading && results.length === 0 && (
          <div className="px-5 py-10 text-center">
            <p className="text-sm" style={{ color: DIM }}>No results for "{query}"</p>
          </div>
        )}

        {!query && (
          <div className="px-5 py-8 text-center">
            <p className="text-sm" style={{ color: DIM }}>Type to search across all content</p>
            <p className="text-xs mt-2" style={{ color: "#1B2A4A" }}>Files · Notes · Tags · Sessions · Projects</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="overflow-y-auto" style={{ maxHeight: "420px" }}>
            {(["file", "note", "tag", "session", "project"] as SearchResult["type"][]).map((type) => {
              const group = results.filter((r) => r.type === type);
              if (group.length === 0) return null;
              return (
                <div key={type}>
                  <div className="px-5 py-2 flex items-center gap-2" style={{ backgroundColor: NAVY }}>
                    <span style={{ color: TYPE_COLORS[type] }}>{TYPE_ICONS[type]}</span>
                    <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: MUTED }}>
                      {TYPE_LABELS[type]}s ({group.length})
                    </span>
                  </div>
                  {group.map((r, gi) => {
                    const globalIdx = results.indexOf(r);
                    const isSelected = globalIdx === selected;
                    return (
                      <button
                        key={r.id}
                        className="w-full flex items-start gap-4 px-5 py-3.5 text-left transition-colors"
                        style={{
                          backgroundColor: isSelected ? "rgba(201,168,76,0.08)" : "transparent",
                          borderLeft: isSelected ? `2px solid ${GOLD}` : "2px solid transparent",
                        }}
                        onMouseEnter={() => setSelected(globalIdx)}
                        onClick={() => { onNavigate(r.type, r.id); onClose(); }}
                      >
                        <span className="mt-0.5 flex-shrink-0" style={{ color: TYPE_COLORS[type] }}>
                          {TYPE_ICONS[type]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "#FFFFFF" }}>{r.title}</p>
                          {r.subtitle && (
                            <p className="text-xs truncate mt-0.5" style={{ color: MUTED }}>{r.subtitle}</p>
                          )}
                          {r.tags && r.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {r.tags.slice(0, 4).map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: `${GOLD}18`, color: GOLD }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span
                          className="flex-shrink-0 text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded-full self-center"
                          style={{ backgroundColor: `${TYPE_COLORS[type]}18`, color: TYPE_COLORS[type] }}
                        >
                          {TYPE_LABELS[type]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-3 border-t flex items-center gap-4" style={{ borderColor: BORDER }}>
          <span className="text-[10px] tracking-widest uppercase" style={{ color: DIM }}>
            ↑↓ Navigate · Enter to open · Esc to close
          </span>
          {results.length > 0 && (
            <span className="ml-auto text-[10px]" style={{ color: DIM }}>{results.length} results</span>
          )}
        </div>
      </div>
    </div>
  );
}
