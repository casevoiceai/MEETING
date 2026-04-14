import { useState, useEffect } from "react";

type ServiceStatus = "Connected" | "Error" | "Warning";

type Service = {
  name: string;
  status: ServiceStatus;
  error: string;
};

export default function SystemHealthPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [driveStatus, setDriveStatus] = useState<Service>({
    name: "Google Drive",
    status: "Warning",
    error: "Checking connection...",
  });

  const checkDrive = async () => {
    try {
      const res = await fetch(
        "https://lzkiwsqezugptwugcehg.supabase.co/functions/v1/google-drive-sync",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "test_connection",
          }),
        }
      );

      const data = await res.json();

      if (data?.connected) {
        setDriveStatus({
          name: "Google Drive",
          status: "Connected",
          error: "Drive is connected and working",
        });
      } else {
        setDriveStatus({
          name: "Google Drive",
          status: "Error",
          error: data?.error || "Unknown error",
        });
      }
    } catch (err: any) {
      setDriveStatus({
        name: "Google Drive",
        status: "Error",
        error: err.message,
      });
    }
  };

  useEffect(() => {
    checkDrive();
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#111D30] border border-[#1B2A4A] text-[#C9A84C]"
      >
        SYSTEM HEALTH
      </button>

      {isOpen && (
        <div className="fixed right-0 top-[60px] h-[calc(100vh-60px)] w-[360px] bg-[#0D1B2E] border-l border-[#1B2A4A] z-[2000] overflow-y-auto">
          <div className="p-4 border-b border-[#1B2A4A]">
            <p className="text-xs text-gray-400">LIVE SYSTEM STATUS</p>
          </div>

          <div className="p-4">
            <div className="border border-[#1B2A4A] rounded p-3">
              <div className="flex justify-between">
                <span className="text-white text-xs font-bold">
                  Google Drive
                </span>

                <span
                  className={
                    driveStatus.status === "Connected"
                      ? "text-green-400 text-xs"
                      : driveStatus.status === "Error"
                      ? "text-red-400 text-xs"
                      : "text-yellow-400 text-xs"
                  }
                >
                  {driveStatus.status}
                </span>
              </div>

              <p className="text-[10px] text-gray-400 mt-2">
                {driveStatus.error}
              </p>

              <button
                onClick={checkDrive}
                className="mt-3 text-[10px] px-2 py-1 border border-blue-500 text-blue-400 rounded"
              >
                Recheck
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
