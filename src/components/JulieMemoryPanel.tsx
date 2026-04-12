import { useEffect, useState } from "react";
import { getMemoryBySession, MemoryItem } from "../lib/julieMemory";

export default function JulieMemoryPanel({ sessionId }: { sessionId: string }) {
  const [items, setItems] = useState<MemoryItem[]>([]);

  useEffect(() => {
    setItems(getMemoryBySession(sessionId));
  }, [sessionId]);

  const group = (type: string) =>
    items.filter((i) => i.type === type && i.status !== "resolved");

  return (
    <div style={{ padding: 12 }}>
      <h3>Memory</h3>

      <Section title="Open Questions" items={group("question")} />
      <Section title="Tasks" items={group("task")} />
      <Section title="Decisions" items={group("decision")} />
      <Section title="Topics" items={group("topic")} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: MemoryItem[] }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <strong>{title}</strong>
      <ul>
        {items.map((i) => (
          <li key={i.id}>{i.content}</li>
        ))}
      </ul>
    </div>
  );
}
