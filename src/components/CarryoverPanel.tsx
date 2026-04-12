import { getCarryover } from "../lib/sessionCarryover";

export default function CarryoverPanel({ sessionId }: { sessionId: string }) {
  const items = getCarryover(sessionId);

  return (
    <div>
      <h3>Carryover</h3>
      <ul>
        {items.map((i) => (
          <li key={i.id}>{i.content}</li>
        ))}
      </ul>
    </div>
  );
}
