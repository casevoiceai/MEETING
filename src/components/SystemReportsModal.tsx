import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SystemReportsModal({ isOpen, onClose }: Props) {
  const [position, setPosition] = useState({ x: 140, y: 90 });
  const dragRef = useRef({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!dragRef.current.dragging) return;

      setPosition({
        x: Math.max(16, event.clientX - dragRef.current.offsetX),
        y: Math.max(16, event.clientY - dragRef.current.offsetY),
      });
    };

    const handleUp = () => {
      dragRef.current.dragging = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    dragRef.current.dragging = true;
    dragRef.current.offsetX = event.clientX - position.x;
    dragRef.current.offsetY = event.clientY - position.y;
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9500]">

      {/* BACKGROUND CLICK CLOSE */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* MODAL */}
      <div
        className="absolute w-[780px] max-w-[94vw] h-[80vh] max-h-[820px] rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: "#0D1B2E",
          borderColor: "#1B2A4A",
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >

        {/* HEADER */}
        <div
          className="px-5 py-4 border-b flex items-start justify-between cursor-move select-none"
          style={{ backgroundColor: "#111D30", borderColor: "#1B2A4A" }}
          onMouseDown={startDrag}
        >
          <div>
            <div className="text-white font-bold text-[28px]">System Reports</div>
            <div className="text-[12px] text-[#8A9BB5]">
              Active reports and system messages
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-white hover:text-red-500 text-[26px]"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 flex items-center justify-center text-[#8A9BB5]">
          Reports panel active
        </div>

      </div>
    </div>,
    document.body
  );
}
