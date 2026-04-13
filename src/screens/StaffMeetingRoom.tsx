import React from 'react';

export default function StaffMeetingRoom() {
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

      <div
        style={{
          fontSize: '28px',
          marginBottom: '20px',
        }}
      >
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
        onClick={() => alert('Button works')}
      >
        ENTER ROOM
      </button>
    </div>
  );
}
