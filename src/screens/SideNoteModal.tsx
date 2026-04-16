import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Tag, Minus } from "lucide-react";

const TEAM_MEMBERS = [
  "Tech-9", "Jack", "Max", "Doc", "Flatfoot",
  "Prez", "Sam", "Attack Lawyer", "Defense Lawyer", "Jamison",
  "Jerry", "Watcher", "Karen", "Mailman", "Scout",
  "CIPHER", "That Guy", "Julie",
];

export interface SideNote {
  text: string;
  mentors: string[];
  tags: string[];
  timestamp: number;
}

interface SideNotePanelProps {
  usedTags: string[];
  onSave: (note: SideNote, newTags: string[]) => void;
  onClose: () => void;
}

function MentorPicker({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() =>
    TEAM_MEMBERS.filter((m) => m.toLowerCase().includes(query.toLowerCase()) && !selected.includes(m)),
    [query, selected]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function openDropdown() {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  }

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }

  const dropdownStyle = rect ? {
    position: "fixed" as const, top: rect.bottom + 4, left: rect.left,
    width: rect.width, zIndex: 9999, backgroundColor: "#EDD98A",
    border: "1px solid #D6C47A", borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)", maxHeight: "300px", overflowY: "auto" as const,
  } : {};

  return (
    <div ref={containerRef}>
      <div ref={triggerRef}
        className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl cursor-text min-h-[44px]"
        style={{ backgroundColor: "rgba(255,255,255,0.35)", border: `1px solid ${open ? "#B8943C" : "#D6C47A"}` }}
        onClick={openDropdown}>
        {selected.map((m) => (
          <span key={m} className="inline-flex items-center gap-1 text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#C9A84C33", color: "#3A2D00", border: "1px solid #C9A84C66" }}>
            {m}
            <button onClick={(e) => { e.stopPropagation(); toggle(m); }} className="opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
        <input className="bg-transparent outline-none text-sm flex-1 min-w-[80px]" style={{ color: "#1B1B1B" }}
          placeholder={selected.length === 0 ? "Tag team members..." : ""}
          value={query} onChange={(e) => { setQuery(e.target.value); openDropdown(); }} onFocus={openDropdown} />
      </div>
      {open && rect && createPortal(
        <div style={dropdownStyle}>
          {filtered.length === 0 && (
            <p className="px-4 py-3 text-sm font-semibold" style={{ color: "#5A4E00" }}>
              {query ? "No match." : "All members selected."}
            </p>
          )}
          {filtered.map((member) => (
            <button key={member} onMouseDown={(e) => { e.preventDefault(); toggle(member); setQuery(""); }}
              className="w-full text-left px-4 py-3 transition-colors hover:bg-yellow-200 border-b last:border-b-0"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <p className="text-sm font-bold tracking-widest uppercase" style={{ color: "#1B1B1B" }}>{member}</p>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function SideNotePanel({ usedTags, onSave, onClose }: SideNotePanelProps) {
  const [text, setText] = useState("");
  const [selectedMentors, setSelectedMentors] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 420, y: 80 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!minimized) setTimeout(() => textAreaRef.current?.focus(), 50);
  }, [minimized]);

  function startDrag(e: React.MouseEvent) {
    setDragging(true);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y)),
      });
    }
    function onUp() { setDragging(false); }
    if (dragging) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  function addTag(raw: string) {
    const cleaned = raw.trim().replace(/\s+/g, "_").toUpperCase();
    if (!cleaned) return;
    const withHash = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
    if (!selectedTags.includes(withHash)) setSelectedTags((prev) => [...prev, withHash]);
    setTagInput("");
  }

  function handleSave() {
    if (!text.trim()) return;
    const newTags = selectedTags.filter((t) => !usedTags.includes(t));
    onSave({ text: text.trim(), mentors: selectedMentors, tags: selectedTags, timestamp: Date.now() }, newTags);
    setText("");
    setSelectedMentors([]);
    setSelectedTags([]);
  }

  if (minimized) {
    return createPortal(
      <div
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1000, cursor: "grab" }}
        onMouseDown={startDrag}>
        <button
          onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold tracking-widest uppercase shadow-lg"
          style={{
            backgroundColor: text.trim() ? "#C9A84C" : "#F5E6A3",
            color: "#1B1B1B",
            border: "2px solid #D6C47A",
          }}>
          📝 Side Note {text.trim() ? "●" : ""}
        </button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      style={{
        position: "fixed", left: pos.x, top: pos.y, zIndex: 1000,
        width: "400px", userSelect: dragging ? "none" : "auto",
      }}>
      <div className="rounded-2xl flex flex-col gap-4 p-6 shadow-2xl"
        style={{
          backgroundColor: "#F5E6A3", border: "2px solid #D6C47A",
          backgroundImage: "linear-gradient(to bottom, transparent 95%, rgba(0,0,0,0.05) 96%)",
          backgroundSize: "100% 28px",
        }}>
        <div className="flex items-center justify-between cursor-grab" onMouseDown={startDrag}>
          <span className="text-sm font-bold tracking-widest uppercase select-none" style={{ color: "#1B1B1B" }}>
            Side Note
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setMinimized(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-black/10"
              style={{ color: "#1B1B1B" }} title="Minimize">
              <Minus size={14} />
            </button>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-black/10"
              style={{ color: "#1B1B1B" }} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        <textarea ref={textAreaRef} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Write your note here..."
          rows={5}
          className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
          style={{ backgroundColor: "rgba(255,255,255,0.35)", color: "#1B1B1B", border: "1px solid #D6C47A", lineHeight: "1.6" }} />

        <MentorPicker selected={selectedMentors} onChange={setSelectedMentors} />

        <div className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl min-h-[42px] cursor-text"
          style={{ backgroundColor: "rgba(255,255,255,0.35)", border: "1px solid #D6C47A" }}
          onClick={() => document.getElementById("side-tag-input")?.focus()}>
          <Tag size={14} className="self-center mr-0.5 flex-shrink-0" style={{ color: "#5A4E00" }} />
          {selectedTags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#D6C47A", color: "#1B1B1B" }}>
              {tag}
              <button onClick={() => setSelectedTags((p) => p.filter((t) => t !== tag))} className="hover:opacity-60">
                <X size={10} />
              </button>
            </span>
          ))}
          <input id="side-tag-input" type="text" value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === ",") { e.preventDefault(); addTag(tagInput); }
              if (e.key === "Backspace" && tagInput === "" && selectedTags.length > 0) setSelectedTags((p) => p.slice(0, -1));
            }}
            placeholder={selectedTags.length === 0 ? "#IDEA, #RISK, #TASK..." : ""}
            className="flex-1 min-w-[80px] text-sm outline-none bg-transparent" style={{ color: "#1B1B1B" }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: "#5A4E00" }}>
            {selectedMentors.length > 0 && `for ${selectedMentors.join(", ")} `}
            {selectedTags.join(" ")}
          </span>
          <button onClick={handleSave} disabled={!text.trim()}
            className="px-6 py-2.5 rounded-xl text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}>
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
