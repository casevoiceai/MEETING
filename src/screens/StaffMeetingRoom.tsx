import React from 'react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function StaffMeetingRoom() {
  const hasUrl = !!supabaseUrl;
  const hasKey = !!supabaseAnonKey;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#000000',
        color: '#00FF00',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '56px',
            fontWeight: 900,
            lineHeight: 1.2,
            marginBottom: '32px',
          }}
        >
          STAFF MEETING ROOM SAFE TEST
        </div>

        <div
          style={{
            fontSize: '36px',
            fontWeight: 700,
            marginBottom: '24px',
          }}
        >
          APP IS RUNNING
        </div>

        <div
          style={{
            fontSize: '32px',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          SUPABASE URL: {hasUrl ? 'FOUND' : 'MISSING'}
        </div>

        <div
          style={{
            fontSize: '32px',
            fontWeight: 700,
            marginBottom: '40px',
          }}
        >
          SUPABASE KEY: {hasKey ? 'FOUND' : 'MISSING'}
        </div>

        <div
          style={{
            fontSize: '24px',
            color: '#FFFFFF',
            lineHeight: 1.5,
          }}
        >
          If either one says MISSING, your original app will break until those
          environment variables are added.
        </div>
      </div>
    </div>
  );
}
