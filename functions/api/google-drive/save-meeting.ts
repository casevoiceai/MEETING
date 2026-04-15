export async function onRequestPost(context: any) {
  try {
    console.log("[API] save-meeting POST hit");

    const body = await context.request.json();

    console.log("[API] Received:", body);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Meeting saved (mock)",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
