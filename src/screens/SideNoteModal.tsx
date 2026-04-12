import { useState, useRef, useEffect, useMemo } from "react";
import { X, Tag } from "lucide-react";
import { ALL_MENTOR_NAMES, FALLBACK_MENTOR_NAMES } from "../lib/mentors";

export interface SideNote {
  text: string;
  mentors: string[];
  tags: string[];
  timestamp: number;
}

interface SideNoteModalProps {
  usedTags: string[];
  onSave: (note: SideNote, newTags: string[]) => void;
  onClose: () => void;
}

function MentorPickerModal({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mentorList = useMemo(() => {
    try {
      return ALL_MENTOR_NAMES.length ? ALL_MENTOR_NAMES : FALLBACK_MENTOR_NAMES;
    } catch {
      return FALLBACK_MENTOR_NAMES;
    }
  }, []);

  const filtered = useMemo(
    () => mentorList.filter((m) => m.toLowerCase().includes(query.toLowerCase()) && !selected.includes(m)),
    [mentorList, query, selected]
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggle(name: string) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl cursor-text min-h-[42px]"
        style={{
          backgroundColor: "rgba(255,255,255,0.35)",
          border: `1px solid ${open ? "#B8943C" : "#D6C47A"}`,
        }}
        onClick={() => setOpen(true)}
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
              className="opacity-60 hover:opacity-100 leading-none"
            >×</button>
          </span>
        ))}
        <input
          className="bg-transparent outline-none text-sm flex-1 min-w-[80px]"
          style={{ color: "#1B1B1B" }}
          placeholder={selected.length === 0 ? "Tag mentors..." : ""}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl"
          style={{ backgroundColor: "#EDD98A", border: "1px solid #D6C47A", maxHeight: "200px", overflowY: "auto" }}
        >
          {filtered.length === 0 && (
            <p className="px-4 py-2.5 text-xs" style={{ color: "#5A4E00" }}>
              {query ? "No match." : "All mentors selected."}
            </p>
          )}
          {filtered.map((name) => (
            <button
              key={name}
              onMouseDown={(e) => { e.preventDefault(); toggle(name); setQuery(""); }}
              className="w-full text-left px-4 py-2.5 text-sm font-bold tracking-widest uppercase transition-colors hover:bg-yellow-200"
              style={{ color: "#1B1B1B" }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SideNoteModal({ usedTags, onSave, onClose }: SideNoteModalProps) {
  const [text, setText] = useState("");
  const [selectedMentors, setSelectedMentors] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const tagSuggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tagSuggestRef.current && !tagSuggestRef.current.contains(e.target as Node)) {
        setTagSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addTag(raw: string) {
    const cleaned = raw.trim().replace(/\s+/g, "_").toUpperCase();
    if (!cleaned) return;
    const withHash = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
    if (!selectedTags.includes(withHash)) {
      setSelectedTags((prev) => [...prev, withHash]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === "Backspace" && tagInput === "" && selectedTags.length > 0) {
      setSelectedTags((prev) => prev.slice(0, -1));
    }
  }

  function handleSave() {
    if (!text.trim()) return;
    const newTagsToAdd = selectedTags.filter((t) => !usedTags.includes(t));
    onSave(
      { text: text.trim(), mentors: selectedMentors, tags: selectedTags, timestamp: Date.now() },
      newTagsToAdd
    );
  }

  const filteredSuggestions = usedTags.filter(
    (t) => !selectedTags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl p-6 flex flex-col gap-4"
        style={{
          backgroundColor: "#F5E6A3",
          border: "1px solid #D6C47A",
          boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
          backgroundImage: "linear-gradient(to bottom, transparent 95%, rgba(0,0,0,0.05) 96%)",
          backgroundSize: "100% 28px",
          fontFamily: "'Inter', sans-serif",
          minHeight: "440px",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: "#1B1B1B" }}>
            Side Note
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors hover:bg-black/10"
            style={{ color: "#1B1B1B" }}
          >
            <X size={16} />
          </button>
        </div>

        <textarea
          ref={textAreaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your note here..."
          rows={5}
          className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all"
          style={{
            backgroundColor: "rgba(255,255,255,0.35)",
            color: "#1B1B1B",
            border: "1px solid #D6C47A",
            lineHeight: "1.6",
          }}
        />

        <MentorPickerModal selected={selectedMentors} onChange={setSelectedMentors} />

        <div ref={tagSuggestRef} className="relative">
          <div
            className="flex flex-wrap gap-1.5 px-3 py-2 rounded-xl min-h-[42px] cursor-text"
            style={{
              backgroundColor: "rgba(255,255,255,0.35)",
              border: "1px solid #D6C47A",
            }}
            onClick={() => document.getElementById("tag-input-field")?.focus()}
          >
            <Tag size={14} className="self-center mr-0.5 flex-shrink-0" style={{ color: "#5A4E00" }} />
            {selectedTags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#D6C47A", color: "#1B1B1B" }}
              >
                {tag}
                <button
                  onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                  className="hover:opacity-60 transition-opacity"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              id="tag-input-field"
              type="text"
              value={tagInput}
              onChange={(e) => { setTagInput(e.target.value); setTagSuggestOpen(true); }}
              onKeyDown={handleTagKeyDown}
              onFocus={() => setTagSuggestOpen(true)}
              placeholder={selectedTags.length === 0 ? "#IDEA, #RISK, #ZTASK..." : ""}
              className="flex-1 min-w-[80px] text-sm outline-none bg-transparent"
              style={{ color: "#1B1B1B" }}
            />
          </div>
          {tagSuggestOpen && filteredSuggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-10"
              style={{
                backgroundColor: "#EDD98A",
                border: "1px solid #D6C47A",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              }}
            >
              <p className="px-4 pt-2 pb-1 text-[10px] tracking-widest uppercase" style={{ color: "#5A4E00" }}>
                Previously used
              </p>
              {filteredSuggestions.map((tag) => (
                <button
                  key={tag}
                  onMouseDown={(e) => { e.preventDefault(); addTag(tag); setTagSuggestOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm transition-colors hover:bg-yellow-200"
                  style={{ color: "#1B1B1B" }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs" style={{ color: "#5A4E00" }}>
            {selectedMentors.length > 0 && `for ${selectedMentors.join(", ")} · `}
            {selectedTags.length > 0 && selectedTags.join(" ")}
          </span>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="px-5 py-2 rounded-xl text-sm font-bold tracking-wider uppercase transition-all duration-150 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#C9A84C", color: "#0D1B2E" }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
