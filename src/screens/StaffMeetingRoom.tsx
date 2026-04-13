import React from 'react';

export default function StaffMeetingRoom() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000000',
        color: '#00FF00',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Arial, sans-serif',
        padding: '40px',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '64px',
            fontWeight: 900,
            lineHeight: 1.2,
            marginBottom: '28px',
          }}
        >
          STAFF APP SAFE MODE
        </div>

        <div
          style={{
            fontSize: '38px',
            fontWeight: 800,
            marginBottom: '24px',
          }}
        >
          APP IS WORKING
        </div>

        <div
          style={{
            fontSize: '30px',
            fontWeight: 700,
            marginBottom: '18px',
          }}
        >
          SUPABASE IS OFF
        </div>

        <div
          style={{
            fontSize: '24px',
            color: '#FFFFFF',
            lineHeight: 1.5,
          }}
        >
          This app is running without MyStatement keys so nothing gets mixed up
          or damaged.
        </div>
      </div>
    </div>
  );
}
