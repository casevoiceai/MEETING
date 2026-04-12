import { useState, useEffect } from "react";
import { Trash2, Search } from "lucide-react";
import { listSideNotes, deleteSideNote, listAllTags, type SideNote, type TagEntry } from "../lib/db";

export default function VaultView() {
  const [notes, setNotes] = useState<SideNote[]>([]);
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listSideNotes({ archived: false }), listAllTags()]).then(([n, t]) => {
      setNotes(n);
      setTags(t);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    await deleteSideNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  const filtered = notes.filter((n) => {
    const matchesTag = activeTag ? n.tags.includes(activeTag) : true;
    const matchesSearch = search ? n.text.toLowerCase().includes(search.toLowerCase()) : true;
    return matchesTag && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "#8A9BB5" }}>Side Notes Vault</p>

      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4"
        style={{ backgroundColor: "#111D30", border: "1px solid #1B2A4A" }}
      >
        <Search size={13} style={{ color: "#3A4F6A" }} />
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: "#FFFFFF" }}
        />
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setActiveTag(null)}
            className="text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1 rounded-full transition-all"
            style={{
              backgroundColor: activeTag === null ? "#C9A84C" : "rgba(201,168,76,0.1)",
              color: activeTag === null ? "#0D1B2E" : "#C9A84C",
            }}
          >
            All
          </button>
          {tags.map((t) => (
            <button
              key={t.tag}
              onClick={() => setActiveTag(activeTag === t.tag ? null : t.tag)}
              className="text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1 rounded-full transition-all"
              style={{
                backgroundColor: activeTag === t.tag ? "#C9A84C" : "rgba(201,168,76,0.1)",
                color: activeTag === t.tag ? "#0D1B2E" : "#C9A84C",
              }}
            >
              {t.tag} <span style={{ opacity: 0.6 }}>({t.usage_count})</span>
            </button>
          ))}
        </div>
      )}

      {loading && <p className="text-sm" style={{ color: "#3A4F6A" }}>Loading...</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-sm" style={{ color: "#3A4F6A" }}>
          {search || activeTag ? "No notes match that filter." : "No side notes saved yet."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((note) => (
          <div
            key={note.id}
            className="rounded-xl px-4 py-3 group"
            style={{ backgroundColor: "#111D30", border: "1px solid #1B2A4A" }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-relaxed flex-1" style={{ color: "#D0DFEE" }}>{note.text}</p>
              <button
                onClick={() => handleDelete(note.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
              >
                <Trash2 size={13} style={{ color: "#F87171" }} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] tracking-widest uppercase font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#C9A84C" }}
                >
                  {tag}
                </span>
              ))}
              {note.mentors.length > 0 && (
                <span className="text-[9px] tracking-widest uppercase" style={{ color: "#3A4F6A" }}>
                  {note.mentors.join(", ")}
                </span>
              )}
              <span className="text-[9px] ml-auto" style={{ color: "#2A3D5E" }}>
                {new Date(note.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
