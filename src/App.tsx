import React from "react";
import StaffMeetingRoom from "./screens/StaffMeetingRoom";

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown render error",
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("APP CRASH:", error);
    console.error("ERROR INFO:", errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "#0D1B2E",
            color: "#FFFFFF",
            padding: "32px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <h1 style={{ color: "#F87171", fontSize: "28px", marginBottom: "16px" }}>
            StaffMeetingRoom crashed
          </h1>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#13233C",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #1B2A4A",
            }}
          >
            {this.state.errorMessage}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0D1B2E",
          color: "#FFFFFF",
        }}
      >
        <StaffMeetingRoom sessionId={null} sessionKey={null} />
      </div>
    </ErrorBoundary>
  );
}
