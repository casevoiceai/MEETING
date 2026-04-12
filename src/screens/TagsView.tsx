import { useState, useEffect } from "react";
import { listAllTags, type TagEntry } from "../lib/db";

export default function TagsView() {
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAllTags().then((t) => {
      setTags(t);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <p className="text-xs tracking-widest uppercase mb-4" style={{ color: "#8A9BB5" }}>Tag Registry</p>

      {loading && <p className="text-sm" style={{ color: "#3A4F6A" }}>Loading...</p>}
      {!loading && tags.length === 0 && (
        <p className="text-sm" style={{ color: "#3A4F6A" }}>No tags used yet. Add tags to side notes to build the registry.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ backgroundColor: "#111D30", border: "1px solid #1B2A4A" }}
          >
            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#C9A84C" }}>
              {t.tag}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#8A9BB5" }}
            >
              {t.usage_count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
