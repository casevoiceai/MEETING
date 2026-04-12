import StaffMeetingRoom from "./screens/StaffMeetingRoom";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0D1B2E",
        color: "#FFFFFF",
      }}
    >
      <StaffMeetingRoom sessionId={null} sessionKey={null} />
    </div>
  );
}
