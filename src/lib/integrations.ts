export async function saveMeetingToDrive() {
  try {
    console.log("[DRIVE] Starting save...");

    const token = localStorage.getItem("sb-access-token");

    if (!token) {
      console.error("[DRIVE] No auth token found");
      return { success: false, error: "No auth token" };
    }

    const today = new Date().toISOString().split("T")[0];

    const transcript = `
Julie: What are we building?
Founder: A founder operating system.

Scout: What competitors exist?
(no answer yet)
`;

    const summary = `
# Meeting Summary

## Goals
- Build founder workspace
- Integrate Google Drive + Notion

## Decisions
- Manual + Auto Save
- Store in dated folders

## Open Questions
- How should tasks sync?
- Founder health tracking?

## Action Items
- Build Drive integration
- Test system
`;

    const response = await fetch(
      "https://lzkiwsqezugptwugcehg.supabase.co/functions/v1/google-drive-sync",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "save_meeting",
          date: today,
          transcript,
          summary,
        }),
      }
    );

    const data = await response.json();

    console.log("[DRIVE] Response:", data);

    return data;
  } catch (err) {
    console.error("[DRIVE ERROR]", err);
    return { success: false };
  }
}
