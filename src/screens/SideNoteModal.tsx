import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Tag, Minus } from "lucide-react";

const NOTES_KEY = "casevoice_sidenotes_v2";
const OPEN_IDS_KEY = "casevoice_open_note_ids";

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

interface PersistedNote {
  id: string;
  text: string;
  mentors: string[];
  tags: string[];
  pos: { x: number; y: number };
  size: { w: number; h: number };
  minimized: boolean;
}

function loadNote(id: string): PersistedNote | null {
  try {
    const d = localStorage.getItem(`${NOTES_KEY}:${id}`);
    return d ? JSON.parse(d) : null;
  } catch {
    return null;
  }
}

function saveNote(note: PersistedNote) {
  localStorage.setItem(`${NOTES_KEY}:${note.id}`, JSON.stringify(note));
}

function deleteNote(id: string) {
  localStorage.removeItem(`${NOTES_KEY}:${id}`);
}

export function loadOpenNoteIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(OPEN_IDS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveOpenNoteIds(ids: string[]) {
  localStorage.setItem(OPEN_IDS_KEY, JSON.stringify(ids));
}

function MentorPicker({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      TEAM_MEMBERS.filter(
        (m) => m.toLowerCase().includes(query.toLowerCase()) && !selected.includes(m)
      ),
    [query, selected]
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
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

  const dropdownStyle = rect
    ? {
        position: "fixed" as const,
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
        backgroundColor: "#EDD98A",
        border: "1px solid #D6C47A",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
        maxHeight: "300px",
        overflowY: "auto" as const,
      }
    : {};

  return (
    <div ref={containerRef}>
      <div
        ref={triggerRef}
        className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl cursor-text min-h-[44px]"
        style={{
          backgroundColor: "rgba(255,255,255,0.35)",
          border: `1px solid ${open ? "#B8943C" : "#D6C47A"}`,
        }}
        onClick={openDropdown}
      >
        {selected.map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
            style={{ backgroundColor: "#C9A84C33", color: "#3A2D00", border: "1px solid #C9A84C66" }}
          >
            {m}
            <button
              onClick={(e) => { e.stopPropagation(); toggle(m); }}
              className="opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="bg-transparent outline-none text-sm flex-1 min-w-[80px]"
          style={{ color: "#1B1B1B" }}
          placeholder={selected.length === 0 ? "Tag team members..." : ""}
          value={query}
          onChange={(e) => { setQuery(e.target.value); openDropdown(); }}
          onFocus={openDropdown}
        />
      </div>
      {open && rect &&
        createPortal(
          <div style={dropdownStyle}>
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm font-semibold" style={{ color: "#5A4E00" }}>
                {query ? "No match." : "All members selected."}
              </p>
            )}
            {filtered.map((member) => (
              <button
                key={member}
                onMouseDown={(e) => { e.preventDefault(); toggle(member); setQuery(""); }}
                className="w-full text-left px-4 py-3 transition-colors hover:bg-yellow-200 border-b last:border-b-0"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
                <p className="text-sm font-bold tracking-widest uppercase" style={{ color: "#1B1B1B" }}>
                  {member}
                </p>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

interface SingleNoteProps {
  id: string;
  usedTags: string[];
  onClose: (id: string) => void;
  onSave: (note: SideNote, newTags: string[]) => void;
  onContentChange: (id: string, hasContent: boolean) => void;
}

function SingleNote({ id, usedTags, onClose, onSave, onContentChange }: SingleNoteProps) {
  const saved = loadNote(id);

  const defaultPos = () => ({
    x: Math.max(20, window.innerWidth - 440 - Math.floor(Math.random() * 80)),
    y: Math.max(20, 80 + Math.floor(Math.random() * 40)),
  });

  const [text, setText] = useState(saved?.text ?? "");
  const [mentors, setMentors] = useState<string[]>(saved?.mentors ?? []);
  const [tags, setTags] = useState<string[]>(saved?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [minimized, setMinimized] = useState(saved?.minimized ?? false);
  const [pos, setPos] = useState(saved?.pos ?? defaultPos());
  const [size, setSize] = useState(saved?.size ?? { w: 400, h: 320 });

  const posRef = useRef(pos);
  const sizeRef = useRef(size);
  posRef.current = pos;
  sizeRef.current = size;

  // Auto-persist on any change
  useEffect(() => {
    saveNote({ id, text, mentors, tags, pos, size, minimized });
    onContentChange(id, text.trim().length > 0);
  }, [text, mentors, tags, pos, size, minimized]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX - posRef.current.x;
    const startY = e.clientY - posRef.current.y;

    function onMove(ev: MouseEvent) {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - sizeRef.current.w, ev.clientX - startX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, ev.clientY - startY)),
      });
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = sizeRef.current.w;
    const startH = sizeRef.current.h;

    function onMove(ev: MouseEvent) {
      setSize({
        w: Math.max(300, startW + ev.clientX - startX),
        h: Math.max(220, startH + ev.clientY - startY),
      });
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function handleClose() {
    deleteNote(id);
    onClose(id);
  }

  function handleSave() {
    if (!text.trim()) return;
    const newTags = tags.filter((t) => !usedTags.includes(t));
    onSave({ text: text.trim(), mentors, tags, timestamp: Date.now() }, newTags);
    // NOTE: intentionally does NOT clear text or close -- note stays open and editable
  }

  function addTag(raw: string) {
    const cleaned = raw.trim().replace(/\s+/g, "_").toUpperCase();
    if (!cleaned) return;
    const withHash = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
    if (!tags.includes(withHash)) setTags((prev) => [...prev, withHash]);
    setTagInput("");
  }

  const textareaHeight = Math.max(100, size.h - 248);

  if (minimized) {
    return createPortal(
      <div
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 1000, cursor: "grab" }}
        onMouseDown={startDrag}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold tracking-widest uppercase shadow-lg"
          style={{
            backgroundColor: text.trim() ? "#C9A84C" : "#F5E6A3",
            color: "#1B1B1B",
            border: "2px solid #D6C47A",
          }}
        >
          📝 Side Note{text.trim() ? " ●" : ""}
        </button>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 1000,
        width: size.w,
      }}
    >
      <div
        className="rounded-2xl flex flex-col shadow-2xl"
        style={{
          backgroundColor: "#F5E6A3",
          border: "2px solid #D6C47A",
          position: "relative",
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-t-2xl select-none"
          style={{ borderBottom: "1px solid #D6C47A", cursor: "grab" }}
          onMouseDown={startDrag}
        >
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: "#1B1B1B" }}>
            Side Note
          </span>
          <div className="flex items-center gap-2">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setMinimized(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10"
              style={{ color: "#1B1B1B" }}
              title="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10"
              style={{ color: "#1B1B1B" }}
              title="Close note"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-3 p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your note here..."
            style={{
              height: textareaHeight,
              resize: "none",
              backgroundColor: "rgba(255,255,255,0.45)",
              color: "#1B1B1B",
              border: "1px solid #D6C47A",
              lineHeight: "1.6",
            }}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          />

          <MentorPicker selected={mentors} onChange={setMentors} />

          <div
            className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl min-h-[42px] cursor-text"
            style={{ backgroundColor: "rgba(255,255,255,0.35)", border: "1px solid #D6C47A" }}
            onClick={() => document.getElementById(`side-tag-input-${id}`)?.focus()}
          >
            <Tag size={14} className="self-center mr-0.5 flex-shrink-0" style={{ color: "#5A4E00" }} />
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#D6C47A", color: "#1B1B1B" }}
              >
                {tag}
                <button onClick={() => setTags((p) => p.filter((t) => t !== tag))}>
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              id={`side-tag-input-${id}`}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " " || e.key === ",") {
                  e.preventDefault();
                  addTag(tagInput);
                }
                if (e.key === "Backspace" && tagInput === "" && tags.length > 0)
                  setTags((p) => p.slice(0, -1));
              }}
              placeholder={tags.length === 0 ? "#IDEA, #RISK, #TASK..." : ""}
              className="flex-1 min-w-[80px] text-sm outline-none bg-transparent"
              style={{ color: "#1B1B1B" }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "#5A4E00" }}>
              {mentors.length > 0 && `for ${mentors.join(", ")} `}
              {tags.join(" ")}
            </span>
            <button
              onClick={handleSave}
              disabled={!text.trim()}
              className="px-6 py-2.5 rounded-xl text-sm font-bold tracking-wider uppercase transition-all hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
            >
              Save
            </button>
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: "se-resize",
            borderRadius: "0 0 14px 0",
            background:
              "linear-gradient(135deg, transparent 40%, #C9A84C 40%, #C9A84C 55%, transparent 55%, transparent 70%, #C9A84C 70%, #C9A84C 85%, transparent 85%)",
          }}
        />
      </div>
    </div>,
    document.body
  );
}

interface SideNotesPanelProps {
  noteIds: string[];
  usedTags: string[];
  onNoteClose: (id: string) => void;
  onSave: (note: SideNote, newTags: string[]) => void;
  onContentChange: (id: string, hasContent: boolean) => void;
}

export default function SideNotesPanel({
  noteIds,
  usedTags,
  onNoteClose,
  onSave,
  onContentChange,
}: SideNotesPanelProps) {
  return (
    <>
      {noteIds.map((id) => (
        <SingleNote
          key={id}
          id={id}
          usedTags={usedTags}
          onClose={onNoteClose}
          onSave={onSave}
          onContentChange={onContentChange}
        />
      ))}
    </>
  );
}
