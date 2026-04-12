import { useState, useEffect, useRef } from "react";
import { Link2, X, Plus, Search, FileText, StickyNote, Tag, Calendar, FolderOpen, ChevronDown } from "lucide-react";
import {
  type LinkableType,
  type LinkedItem,
  type ResolvedLinkTarget,
  addLink,
  removeLink,
  getLinkedItems,
  searchLinkCandidates,
} from "../lib/db";

interface Props {
  sourceType: LinkableType;
  sourceId: string;
  onNavigate?: (type: LinkableType, id: string) => void;
}

const TYPE_LABELS: Record<LinkableType, string> = {
  file: "File",
  note: "Note",
  tag: "Tag",
  session: "Session",
  project: "Project",
};

const TYPE_COLORS: Record<LinkableType, string> = {
  file: "#3B82F6",
  note: "#10B981",
  tag: "#C9A84C",
  session: "#8B5CF6",
  project: "#F97316",
};

function TypeIcon({ type, size = 12 }: { type: LinkableType; size?: number }) {
  const color = TYPE_COLORS[type];
  const props = { size, color };
  if (type === "file") return <FileText {...props} />;
  if (type === "note") return <StickyNote {...props} />;
  if (type === "tag") return <Tag {...props} />;
  if (type === "session") return <Calendar {...props} />;
  if (type === "project") return <FolderOpen {...props} />;
  return null;
}

const ALL_TYPES: LinkableType[] = ["file", "note", "tag", "session", "project"];

export default function LinkedItemsPanel({ sourceType, sourceId, onNavigate }: Props) {
  const [links, setLinks] = useState<LinkedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<LinkableType | "all">("all");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<ResolvedLinkTarget[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    load();
  }, [sourceId, sourceType]);

  async function load() {
    setLoading(true);
    const items = await getLinkedItems(sourceType, sourceId);
    setLinks(items);
    setLoading(false);
  }

  useEffect(() => {
    if (!showSearch) return;
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [showSearch]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQuery.trim()) {
      setCandidates([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchLinkCandidates(searchQuery, sourceType, sourceId);
      const existingIds = new Set(links.map((l) => l.target_id));
      setCandidates(results.filter((r) => !existingIds.has(r.id)));
      setSearching(false);
    }, 300);
  }, [searchQuery]);

  async function handleAdd(candidate: ResolvedLinkTarget) {
    await addLink(sourceType, sourceId, candidate.type, candidate.id);
    setSearchQuery("");
    setCandidates([]);
    setShowSearch(false);
    await load();
  }

  async function handleRemove(link: LinkedItem) {
    await removeLink(sourceType, sourceId, link.target_type, link.target_id);
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
  }

  const filtered = filterType === "all" ? links : links.filter((l) => l.target_type === filterType);
  const typeCounts = ALL_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = links.filter((l) => l.target_type === t).length;
    return acc;
  }, {});

  return (
    <div
      style={{
        background: "#0A1628",
        border: "1px solid #1B2A4A",
        borderRadius: 10,
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Link2 size={14} color="#C9A84C" />
          <span style={{ color: "#C9A84C", fontWeight: 600, fontSize: 13, letterSpacing: 0.3 }}>
            Linked Items
          </span>
          {links.length > 0 && (
            <span
              style={{
                background: "#1B2A4A",
                color: "#8A9BB5",
                borderRadius: 10,
                fontSize: 11,
                padding: "1px 7px",
                fontWeight: 500,
              }}
            >
              {links.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowSearch((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: showSearch ? "#1B2A4A" : "transparent",
            border: "1px solid #1B2A4A",
            borderRadius: 6,
            color: "#8A9BB5",
            padding: "4px 9px",
            fontSize: 12,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1B2A4A"; (e.currentTarget as HTMLButtonElement).style.color = "#C9A84C"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = showSearch ? "#1B2A4A" : "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#8A9BB5"; }}
        >
          <Plus size={12} />
          Link
        </button>
      </div>

      {showSearch && (
        <div style={{ marginBottom: 12, position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#0D1B2E",
              border: "1px solid #2A3F6A",
              borderRadius: 7,
              padding: "7px 10px",
            }}
          >
            <Search size={13} color="#8A9BB5" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files, notes, tags, sessions, projects..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#E8EDF5",
                fontSize: 13,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); setCandidates([]); }}
                style={{ background: "none", border: "none", color: "#8A9BB5", cursor: "pointer", padding: 0, display: "flex" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {(candidates.length > 0 || searching) && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                background: "#0D1B2E",
                border: "1px solid #1B2A4A",
                borderRadius: 8,
                marginTop: 4,
                maxHeight: 240,
                overflowY: "auto",
                zIndex: 50,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              }}
            >
              {searching && (
                <div style={{ padding: "10px 14px", color: "#8A9BB5", fontSize: 12 }}>Searching...</div>
              )}
              {!searching && candidates.map((c) => (
                <button
                  key={`${c.type}-${c.id}`}
                  onClick={() => handleAdd(c)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    padding: "9px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                    borderBottom: "1px solid #0F2040",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1B2A4A"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <TypeIcon type={c.type} size={13} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#E8EDF5", fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.title}
                    </div>
                    {c.subtitle && (
                      <div style={{ color: "#8A9BB5", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.subtitle}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      color: TYPE_COLORS[c.type],
                      background: `${TYPE_COLORS[c.type]}18`,
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {TYPE_LABELS[c.type]}
                  </span>
                </button>
              ))}
              {!searching && candidates.length === 0 && searchQuery && (
                <div style={{ padding: "10px 14px", color: "#8A9BB5", fontSize: 12 }}>No results found</div>
              )}
            </div>
          )}
        </div>
      )}

      {links.length > 0 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
          <FilterPill
            label="All"
            count={links.length}
            active={filterType === "all"}
            onClick={() => setFilterType("all")}
            color="#8A9BB5"
          />
          {ALL_TYPES.filter((t) => typeCounts[t] > 0).map((t) => (
            <FilterPill
              key={t}
              label={TYPE_LABELS[t]}
              count={typeCounts[t]}
              active={filterType === t}
              onClick={() => setFilterType(t)}
              color={TYPE_COLORS[t]}
            />
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#8A9BB5", fontSize: 12, padding: "8px 0" }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            color: "#4A5C7A",
            fontSize: 12,
            padding: "12px 0",
            textAlign: "center",
            borderTop: links.length > 0 ? "1px solid #0F2040" : "none",
          }}
        >
          {links.length === 0
            ? "No linked items yet. Use the Link button to connect this to other items."
            : `No ${filterType} links.`}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((link) => (
            <LinkedRow
              key={link.id}
              link={link}
              onNavigate={onNavigate}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
  color,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: active ? `${color}20` : "transparent",
        border: `1px solid ${active ? color : "#1B2A4A"}`,
        borderRadius: 20,
        color: active ? color : "#8A9BB5",
        padding: "2px 9px",
        fontSize: 11,
        cursor: "pointer",
        fontWeight: active ? 600 : 400,
        transition: "all 0.15s",
      }}
    >
      {label}
      <span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}

function LinkedRow({
  link,
  onNavigate,
  onRemove,
}: {
  link: LinkedItem;
  onNavigate?: (type: LinkableType, id: string) => void;
  onRemove: (link: LinkedItem) => void;
}) {
  const resolved = link.resolved;
  if (!resolved) return null;
  const color = TYPE_COLORS[resolved.type];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 9px",
        background: "#0D1B2E",
        borderRadius: 7,
        border: "1px solid #1B2A4A",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#2A3F6A"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1B2A4A"; }}
    >
      <TypeIcon type={resolved.type} size={13} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#C8D8F0",
            fontSize: 12,
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: onNavigate ? "pointer" : "default",
          }}
          onClick={() => onNavigate?.(resolved.type, resolved.id)}
          title={resolved.title}
        >
          {resolved.title}
        </div>
        {resolved.subtitle && (
          <div style={{ color: "#4A5C7A", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {resolved.subtitle}
          </div>
        )}
      </div>
      <span
        style={{
          fontSize: 10,
          color,
          background: `${color}15`,
          borderRadius: 4,
          padding: "2px 6px",
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {TYPE_LABELS[resolved.type]}
      </span>
      {onNavigate && (
        <button
          onClick={() => onNavigate(resolved.type, resolved.id)}
          title="Open"
          style={{
            background: "none",
            border: "none",
            color: "#4A5C7A",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#C9A84C"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4A5C7A"; }}
        >
          <ChevronDown size={12} style={{ transform: "rotate(-90deg)" }} />
        </button>
      )}
      <button
        onClick={() => onRemove(link)}
        title="Remove link"
        style={{
          background: "none",
          border: "none",
          color: "#4A5C7A",
          cursor: "pointer",
          padding: "2px",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#EF4444"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#4A5C7A"; }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
