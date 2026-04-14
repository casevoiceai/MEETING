import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing Google credentials",
        }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Google Drive config is present",
      }),
      { status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      { status: 500 }
    );
  }
});
