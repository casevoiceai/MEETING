import React, { useState } from 'react';

type Message = {
  role: 'user' | 'mentor';
  text: string;
};

export default function StaffMeetingRoom() {
  const [entered, setEntered] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const generateMentorReply = (text: string) => {
    const lower = text.toLowerCase();

    if (lower.includes('hello') || lower.includes('hi')) {
      return 'Hey. I’m here. What are we working on?';
    }

    if (lower.includes('stuck')) {
      return 'Good. That means you found the edge. What exactly is blocking you?';
    }

    if (lower.includes('idea')) {
      return 'Say it out loud. Even if it’s messy.';
    }

    return 'Talk to me. Give me more detail.';
  };

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', text: trimmed },
    ];

    const reply = generateMentorReply(trimmed);

    setMessages([
      ...newMessages,
      { role: 'mentor', text: reply },
    ]);

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
        <div
          style={{
            fontSize: '56px',
            fontWeight: 900,
            marginBottom: '24px',
            textAlign: 'center',
          }}
        >
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
            {msg.role === 'user' ? 'YOU: ' : 'MENTOR: '}
            {msg.text}
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
