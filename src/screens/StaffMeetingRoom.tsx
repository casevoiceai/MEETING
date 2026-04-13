import React, { useState } from 'react';

export default function StaffMeetingRoom() {
  const [entered, setEntered] = useState(false);

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

        <div style={{ fontSize: '28px', marginBottom: '20px' }}>
          STATUS: READY
        </div>

        <div
          style={{
            fontSize: '24px',
            color: '#FFFFFF',
            marginBottom: '40px',
          }}
        >
          Backend disabled. Safe to build UI.
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
        padding: '40px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          fontWeight: 900,
          marginBottom: '30px',
        }}
      >
        ROOM ACTIVE
      </div>

      <div
        style={{
          fontSize: '28px',
          marginBottom: '20px',
        }}
      >
        You are inside the staff meeting room
      </div>

      <div
        style={{
          fontSize: '22px',
          color: '#FFFFFF',
        }}
      >
        Next: we add mentors + memory + real system
      </div>
    </div>
  );
}
