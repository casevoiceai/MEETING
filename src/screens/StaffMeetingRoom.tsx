import React, { useState } from 'react';

export default function StaffMeetingRoom() {
  const [entered, setEntered] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<string[]>([]);

  if (!entered) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#000000',
          color: '#00FF00',
          display: 'flex',
          flexDirection: 'column',
          padding: '40px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            fontSize: '56px',
            fontWeight: 900,
            marginBottom: '30px',
            textAlign: 'center',
          }}
        >
          STAFF MEETING ROOM
        </div>

        <button
          style={{
            fontSize: '32px',
            padding: '20px',
            background: '#00FF00',
            color: '#000000',
            border: 'none',
            cursor: 'pointer',
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
        padding: '30px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: '40px',
          fontWeight: 900,
          marginBottom: '20px',
        }}
      >
        ROOM ACTIVE
      </div>

      {/* MESSAGE AREA */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '2px solid #00FF00',
          padding: '20px',
          marginBottom: '20px',
          fontSize: '22px',
          background: '#111',
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#888' }}>No messages yet...</div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '10px' }}>
            {msg}
          </div>
        ))}
      </div>

      {/* INPUT */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{
            flex: 1,
            fontSize: '24px',
            padding: '15px',
            background: '#000',
            color: '#00FF00',
            border: '2px solid #00FF00',
          }}
          placeholder="Type something..."
        />

        <button
          onClick={() => {
            if (!input.trim()) return;
            setMessages([...messages, input]);
            setInput('');
          }}
          style={{
            fontSize: '24px',
            padding: '15px 25px',
            background: '#00FF00',
            color: '#000',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          SEND
        </button>
      </div>
    </div>
  );
}
