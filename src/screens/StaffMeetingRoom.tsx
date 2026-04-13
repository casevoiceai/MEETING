import React, { useState } from 'react';

type Message = {
  role: 'user' | 'mentor';
  speaker?: string;
  text: string;
};

export default function StaffMeetingRoom() {
  const [entered, setEntered] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const getMentorReplies = (text: string) => {
    const lower = text.toLowerCase();

    // MAX (strategic)
    let max = 'Be specific. What are you actually trying to do?';
    if (lower.includes('idea')) {
      max = 'Ideas are cheap. What makes this one worth building?';
    }

    // JERRY (blind spot detector)
    let jerry = 'Wait. What are we missing here?';
    if (lower.includes('nothing')) {
      jerry = 'Nothing? Then why are you here?';
    }

    // DOC (calm, structured)
    let doc = 'Let’s slow this down. What’s step one?';
    if (lower.includes('stuck')) {
      doc = 'Good. That means you’ve hit a real constraint. Let’s define it.';
    }

    return [
      { speaker: 'MAX', text: max },
      { speaker: 'JERRY', text: jerry },
      { speaker: 'DOC', text: doc },
    ];
  };

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', text: trimmed },
    ];

    const replies = getMentorReplies(trimmed);

    const mentorMessages = replies.map((r) => ({
      role: 'mentor' as const,
      speaker: r.speaker,
      text: r.text,
    }));

    setMessages([...newMessages, ...mentorMessages]);
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
        }}
      >
        <div style={{ fontSize: '56px', fontWeight: 900, textAlign: 'center', marginBottom: '24px' }}>
          STAFF MEETING ROOM
        </div>

        <button
          style={{
            fontSize: '36px',
            padding: '24px',
            background: '#00FF00',
            color: '#000',
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
      }}
    >
      <div style={{ fontSize: '42px', fontWeight: 900, marginBottom: '16px' }}>
        ROOM ACTIVE
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          border: '2px solid #00FF00',
          padding: '20px',
          marginBottom: '16px',
          fontSize: '26px',
          background: '#050505',
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: '#888' }}>START THE CONVERSATION</div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: '14px',
              color: msg.role === 'user' ? '#00FF00' : '#FFFFFF',
            }}
          >
            {msg.role === 'user'
              ? `YOU: ${msg.text}`
              : `${msg.speaker}: ${msg.text}`}
          </div>
        ))}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') sendMessage();
        }}
        style={{
          fontSize: '28px',
          padding: '18px',
          background: '#000',
          color: '#00FF00',
          border: '2px solid #00FF00',
          marginBottom: '10px',
        }}
        placeholder="TYPE MESSAGE..."
      />

      <button
        onClick={sendMessage}
        style={{
          fontSize: '28px',
          padding: '18px',
          background: '#00FF00',
          color: '#000',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 900,
        }}
      >
        SEND
      </button>
    </div>
  );
}
