import React, { useState } from 'react';

export default function StaffMeetingRoom() {
  const [entered, setEntered] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, trimmed]);
    setInput('');
  };

  if (!entered) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#000000',
          color: '#00FF00',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          fontFamily: 'Arial, sans-serif',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontWeight: 900,
            marginBottom: '24px',
            textAlign: 'center',
            lineHeight: 1.1,
          }}
        >
          STAFF MEETING ROOM
        </div>

        <button
          style={{
            width: '100%',
            fontSize: 'clamp(24px, 4vw, 36px)',
            padding: '22px',
            background: '#00FF00',
            color: '#000000',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 800,
          }}
          onClick={() => setEntered(true)}
        >
          ENTER ROOM
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000000',
        color: '#00FF00',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          fontSize: 'clamp(34px, 5vw, 56px)',
          fontWeight: 900,
          marginBottom: '18px',
          lineHeight: 1.1,
        }}
      >
        ROOM ACTIVE
      </div>

      <div
        style={{
          flex: 1,
          minHeight: '400px',
          overflowY: 'auto',
          border: '2px solid #00FF00',
          padding: '20px',
          marginBottom: '16px',
          fontSize: '28px',
          background: '#050505',
          boxSizing: 'border-box',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: '#aaaaaa' }}>NO MESSAGES YET</div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: '14px',
                color: '#00FF00',
                wordBreak: 'break-word',
              }}
            >
              {msg}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '12px',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage();
          }}
          style={{
            width: '100%',
            fontSize: '32px',
            padding: '18px',
            background: '#000000',
            color: '#00FF00',
            border: '2px solid #00FF00',
            boxSizing: 'border-box',
          }}
          placeholder="TYPE SOMETHING..."
        />

        <button
          onClick={sendMessage}
          style={{
            width: '100%',
            fontSize: '32px',
            padding: '20px',
            background: '#00FF00',
            color: '#000000',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 900,
          }}
        >
          SEND MESSAGE
        </button>
      </div>
    </div>
  );
}
