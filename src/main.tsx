import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { ensureSupabaseSession } from './lib/supabase';

async function startApp() {
  try {
    console.log("Initializing Supabase session...");

    const session = await ensureSupabaseSession();

    if (!session) {
      console.error("FAILED to create Supabase session");
    } else {
      console.log("Supabase session ready");
    }

  } catch (err) {
    console.error("Startup auth error:", err);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

startApp();
