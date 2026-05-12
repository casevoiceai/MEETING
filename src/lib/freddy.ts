export function getFreddySummary(state: {
  ai: string;
  env: string;
  drive: string;
  recon: string;
}) {
  let messages = [];

  if (state.ai === "down") {
    messages.push("Local AI is offline. Restart it to restore system intelligence.");
  }

  if (state.env === "down") {
    messages.push("Environment config is missing or broken. This can cause auth failures.");
  }

  if (state.env === "warn") {
    messages.push("Supabase key format may cause issues with some functions.");
  }

  if (state.drive === "warn") {
    messages.push("Drive connection is unstable. Exports may fail.");
  }

  if (state.recon === "warn") {
    messages.push("System state mismatch detected. Fix upstream issues first.");
  }

  if (messages.length === 0) {
    return "All systems are stable. No action needed.";
  }

  return messages.join(" ");
}
