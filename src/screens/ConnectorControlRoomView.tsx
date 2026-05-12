import {
  CONNECTOR_BOUNDARIES,
  CONNECTOR_CONTROL_ROOM_RULES,
  CONNECTOR_CONTROL_ROOM_SUMMARY,
  CONNECTOR_CONTROL_ROOM_VERSION,
} from "../lib/connectorControlRoom";

import { useEffect as useConnectorReceiptEffect, useState as useConnectorReceiptState } from 'react';

/* CONNECTOR STATUS RECEIPT START */
type ConnectorStatusReceiptTone = "active" | "limited" | "locked";

type ConnectorStatusReceiptRow = {
  name: string;
  status: string;
  note: string;
  tone: ConnectorStatusReceiptTone;
};

function ConnectorStatusReceipt() {
  const [localAiStatus, setLocalAiStatus] = useConnectorReceiptState<"DETECTED" | "NOT DETECTED">("NOT DETECTED");

  useConnectorReceiptEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
      setLocalAiStatus("NOT DETECTED");
    }, 500);

    fetch("http://127.0.0.1:5000/status", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(() => {
        window.clearTimeout(timeoutId);
        setLocalAiStatus("DETECTED");
      })
      .catch(() => {
        window.clearTimeout(timeoutId);
        setLocalAiStatus("NOT DETECTED");
      });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const rows: ConnectorStatusReceiptRow[] = [
    {
      name: "LOCAL CRM",
      status: "RUNNING",
      tone: "active",
      note: "Local app running at 127.0.0.1:5173. Confirmed at end of last session.",
    },
    {
      name: "LOCAL AI",
      status: localAiStatus,
      tone: localAiStatus === "DETECTED" ? "active" : "locked",
      note: "127.0.0.1:5000. This is the only permitted local status check.",
    },
    {
      name: "GOOGLE DRIVE",
      status: "READ LANE ACTIVE",
      tone: "active",
      note: "Drive evidence reading is confirmed through VAULT. No write, delete, move, or permission action is authorized.",
    },
    {
      name: "GITHUB",
      status: "HOLD. REPO IDENTITY NOT CONFIRMED",
      tone: "limited",
      note: "Local CRM folder is not connected to a git repo. Reconnect requires a confirmed plan. No push or commit is authorized.",
    },
    {
      name: "EMAIL",
      status: "DRAFT AND READ ONLY",
      tone: "limited",
      note: "No send, delete, archive, or forward action is authorized. Draft-first until explicitly approved.",
    },
    {
      name: "SUPABASE",
      status: "CLOUD STATE. WRITES LOCKED",
      tone: "limited",
      note: "Read paths exist for app state and metadata. Insert, update, delete, and migration actions remain locked.",
    },
    {
      name: "TEAM MEMBERS",
      status: "SCOPED PACKETS ONLY",
      tone: "limited",
      note: "Team Members receive scoped evidence and task context only. Broad account access, automatic execution, queue writes, and approval actions are locked.",
    },
  ];

  const toneClass = (tone: ConnectorStatusReceiptTone) => {
    if (tone === "active") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    if (tone === "locked") return "border-red-500/40 bg-red-500/10 text-red-200";
    return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-700/80 bg-slate-950/70 p-5 shadow-lg">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Read-only receipt
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-50">
          Connector Status Receipt
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Static connector lane status from the current source brief. Only the Local AI row checks 127.0.0.1:5000.
        </p>
      </div>

      <div className="grid gap-3">
        {rows.map((row) => (
          <div
            key={row.name}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold tracking-wide text-slate-100">
                {row.name}
              </h3>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(row.tone)}`}>
                {row.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{row.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
/* CONNECTOR STATUS RECEIPT END */
/**
 * CASEVOICE_CONNECTOR_CONTROL_ROOM_VIEW_V1
 *
 * Read-only UI screen for connector boundaries.
 *
 * No connector calls.
 * No database calls.
 * No Drive calls.
 * No GitHub calls.
 * No email calls.
 * No Team Member execution.
 */

const exposureLabels: Record<string, string> = {
  local: "Local",
  cloud_read: "Cloud read",
  cloud_write_locked: "Cloud write locked",
  execution_locked: "Execution locked",
};

const exposureClasses: Record<string, string> = {
  local: "border-emerald-500/40 bg-emerald-950/30 text-emerald-100",
  cloud_read: "border-sky-500/40 bg-sky-950/30 text-sky-100",
  cloud_write_locked: "border-amber-500/40 bg-amber-950/30 text-amber-100",
  execution_locked: "border-red-500/40 bg-red-950/30 text-red-100",
};

function BoundaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4">
      <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
        {title}
      </h4>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConnectorControlRoomViewBase() {
  return (
    <main
      className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100"
      data-casevoice-connector-control-room-view-v1="true"
    >
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
            Read-only connector control room
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white">
            Connector Control Room
          </h1>
          <p className="mt-3 max-w-4xl text-base leading-7 text-slate-300">
            This screen shows the local-first boundary for CASEVOICE connectors.
            It is a visibility layer only. It does not call GitHub, Email,
            Google Drive, Supabase, Local AI, or Team Member execution paths.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-4">
              <p className="text-sm font-semibold text-emerald-200">
                Local-first principle
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-100/90">
                {CONNECTOR_CONTROL_ROOM_RULES.localFirstPrinciple}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4">
              <p className="text-sm font-semibold text-amber-200">
                No silent external writes
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-100/90">
                {CONNECTOR_CONTROL_ROOM_RULES.noSilentExternalWrites}
              </p>
            </div>
            <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-4">
              <p className="text-sm font-semibold text-red-200">
                Team Member boundary
              </p>
              <p className="mt-2 text-sm leading-6 text-red-100/90">
                {CONNECTOR_CONTROL_ROOM_RULES.teamMemberBoundary}
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Source contract
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {CONNECTOR_CONTROL_ROOM_VERSION}
              </h2>
            </div>
            <div className="rounded-full border border-slate-600 px-4 py-2 text-sm text-slate-300">
              UI wiring only: no connector writes
            </div>
          </div>
        </section>

        <section className="grid gap-5">
          {CONNECTOR_BOUNDARIES.map((connector) => (
            <article
              key={connector.key}
              className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-lg"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-2xl font-bold text-white">
                      {connector.name}
                    </h3>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        exposureClasses[connector.exposureLevel] ??
                        "border-slate-600 bg-slate-800 text-slate-200"
                      }`}
                    >
                      {exposureLabels[connector.exposureLevel] ??
                        connector.exposureLevel}
                    </span>
                  </div>
                  <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
                    {connector.currentRole}
                  </p>
                  <p className="mt-3 max-w-4xl rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-sm leading-6 text-slate-300">
                    <span className="font-semibold text-slate-100">
                      Founder boundary:
                    </span>{" "}
                    {connector.founderBoundaryNote}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4 text-sm text-slate-300 lg:w-80">
                  <p className="font-semibold text-slate-100">Write policy</p>
                  <p className="mt-2 font-mono text-xs text-amber-200">
                    {connector.writePolicy}
                  </p>
                  <p className="mt-4 font-semibold text-slate-100">
                    Team Member access
                  </p>
                  <p className="mt-2 leading-6">{connector.teamMemberAccess}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <BoundaryList title="Allowed reads" items={connector.allowedReads} />
                <BoundaryList title="Locked writes" items={connector.lockedWrites} />
                <BoundaryList
                  title="Founder approval required"
                  items={connector.approvalRequiredFor}
                />
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5">
            <h3 className="text-lg font-bold text-emerald-100">Safe now</h3>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-emerald-100/90">
              {CONNECTOR_CONTROL_ROOM_SUMMARY.safeNow.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5">
            <h3 className="text-lg font-bold text-red-100">
              Hold until approved
            </h3>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-red-100/90">
              {CONNECTOR_CONTROL_ROOM_SUMMARY.holdUntilApproved.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-red-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
            Next safe UI move
          </p>
          <p className="mt-3 text-base leading-7 text-slate-200">
            {CONNECTOR_CONTROL_ROOM_SUMMARY.nextSafeUiMove}
          </p>
        </section>
      </section>
    </main>
  );
}

/* CONNECTOR STATUS RECEIPT WRAPPER START */
export default function ConnectorControlRoomView() {
  return (
    <>
      <ConnectorStatusReceipt />
      <ConnectorControlRoomViewBase />
    </>
  );
}
/* CONNECTOR STATUS RECEIPT WRAPPER END */

