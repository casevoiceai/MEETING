import React, { useEffect } from 'react';

export default function StaffMeetingRoom() {
  useEffect(() => {
    console.log('StaffMeetingRoom mounted successfully');
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#ffffff',
        color: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        fontWeight: '600',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div>StaffMeetingRoom Loaded</div>
      <div style={{ fontSize: '16px', fontWeight: '400' }}>
        React render + useEffect working
      </div>
    </div>
  );
}
