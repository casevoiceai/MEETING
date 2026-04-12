import { useState, useRef, useEffect } from "react";
import { X, Tag, ChevronDown } from "lucide-react";

const MENTOR_OPTIONS = ["PREZ", "JAMISON", "DOC", "TECHGUY", "SAM", "CIPHER"];

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

export default function SideNoteModal({ usedTags, onSave, onClose }: SideNoteModalProps) {
  const [text, setText] = useState("");
  const [selectedMentors, setSelectedMentors] = useState<string[]>([]);
  const [mentorDropdownOpen, setMentorDropdownOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagSuggestOpen, setTagSuggestOpen] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const mentorRef = useRef<HTMLDivElement>(null);
  const tagSuggestRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mentorRef.current && !mentorRef.current.contains(e.target as Node)) {
        setMentorDropdownOpen(false);
      }
      if (tagSuggestRef.current && !tagSuggestRef.current.contains(e.target as Node)) {
        setTagSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleMentor(name: string) {
    setSelectedMentors((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  }

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
          minHeight: "420px",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold tracking-widest uppercase" style={{ color: "#1B1B1B" }}>
            Side Note
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
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

        <div ref={mentorRef} className="relative">
          <button
            onClick={() => setMentorDropdownOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm transition-colors"
            style={{
              backgroundColor: "rgba(255,255,255,0.35)",
              color: "#1B1B1B",
              border: "1px solid #D6C47A",
            }}
          >
            <span>
              {selectedMentors.length === 0 ? "Tag mentors..." : selectedMentors.join(", ")}
            </span>
            <ChevronDown size={14} style={{ color: "#5A4E00" }} />
          </button>
          {mentorDropdownOpen && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-10"
              style={{
                backgroundColor: "#EDD98A",
                border: "1px solid #D6C47A",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              }}
            >
              {MENTOR_OPTIONS.map((name) => (
                <button
                  key={name}
                  onClick={() => toggleMentor(name)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors hover:bg-yellow-200"
                  style={{ color: "#1B1B1B" }}
                >
                  <span>{name}</span>
                  {selectedMentors.includes(name) && (
                    <span className="text-xs font-bold" style={{ color: "#5A4E00" }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

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
