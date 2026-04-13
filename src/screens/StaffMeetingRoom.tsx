import React, { useEffect } from 'react';

/* SAFE TEST: add ONLY Supabase import layer */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: any = null;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (e) {
  console.error('Supabase init crash:', e);
}

export default function StaffMeetingRoom() {
  useEffect(() => {
    console.log('StaffMeetingRoom mounted');
    console.log('ENV CHECK:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    });
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
        fontSize: '24px',
        fontWeight: '600',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'center',
        padding: '24px',
      }}
    >
      <div>StaffMeetingRoom Loaded</div>

      <div style={{ fontSize: '16px', fontWeight: '400' }}>
        Supabase layer test
      </div>

      <div style={{ fontSize: '14px', fontWeight: '400' }}>
        URL: {supabaseUrl ? 'OK' : 'MISSING'}
      </div>

      <div style={{ fontSize: '14px', fontWeight: '400' }}>
        KEY: {supabaseAnonKey ? 'OK' : 'MISSING'}
      </div>
    </div>
  );
}
