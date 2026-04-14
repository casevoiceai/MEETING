import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ensureSupabaseSession } from "./lib/supabase";

async function startApp() {
  console.error("[BOOT] main.tsx loaded");

  try {
    const session = await ensureSupabaseSession();

    if (session?.access_token) {
      console.error("[BOOT] session ready", session.user?.id ?? "no-user");
    } else {
      console.error("[BOOT] no session returned");
    }
  } catch (error) {
    console.error("[BOOT] startup auth crash", error);
  }

  const rootEl = document.getElementById("root");

  if (!rootEl) {
    console.error("[BOOT] root element missing");
    return;
  }

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

startApp();
