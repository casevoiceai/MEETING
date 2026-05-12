import { useMemo, useState } from "react";

type SectionKey =
  | "ISSUE"
  | "RECOMMENDED FIX"
  | "QUESTIONS FOR FOUNDER"
  | "FIRE LEVEL";

type ParsedSections = Record<SectionKey, string>;

type CheckResult = {
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

const REQUIRED_SECTIONS: SectionKey[] = [
  "ISSUE",
  "RECOMMENDED FIX",
  "QUESTIONS FOR FOUNDER",
  "FIRE LEVEL",
];

const CONTRADICTION_TERMS = [
  ["safe", "dangerous"],
  ["ready", "not ready"],
  ["approved", "blocked"],
  ["low risk", "critical"],
  ["no write", "write"],
  ["no execution", "execute"],
  ["stable", "broken"],
];

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseSections(text: string): ParsedSections {
  const parsed = {
    ISSUE: "",
    "RECOMMENDED FIX": "",
    "QUESTIONS FOR FOUNDER": "",
    "FIRE LEVEL": "",
  } as ParsedSections;

  for (let i = 0; i < REQUIRED_SECTIONS.length; i += 1) {
    const key = REQUIRED_SECTIONS[i];
    const nextKey = REQUIRED_SECTIONS[i + 1];
    const start = text.indexOf(`${key}:`);

    if (start === -1) continue;

    const contentStart = start + key.length + 1;
    const end = nextKey ? text.indexOf(`${nextKey}:`, contentStart) : text.length;

    parsed[key] = normalizeText(
      text.slice(contentStart, end === -1 ? text.length : end)
    );
  }

  return parsed;
}

function sectionCompleteness(parsed: ParsedSections): CheckResult[] {
  return REQUIRED_SECTIONS.map((section) => {
    const value = parsed[section];

    if (!value) {
      return {
        label: section,
        status: "fail",
        detail: "Missing required section.",
      };
    }

    if (value.length < 12) {
      return {
        label: section,
        status: "warn",
        detail: "Section exists but may be too thin.",
      };
    }

    return {
      label: section,
      status: "pass",
      detail: "Section present.",
    };
  });
}

function findContradictions(text: string): string[] {
  const lower = text.toLowerCase();
  const hits: string[] = [];

  for (const [a, b] of CONTRADICTION_TERMS) {
    if (lower.includes(a) && lower.includes(b)) {
      hits.push(`Contains both "${a}" and "${b}".`);
    }
  }

  return hits;
}

function deeperContradictionScan(a: string, b: string): string[] {
  const hits: string[] = [];
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();

  for (const [left, right] of CONTRADICTION_TERMS) {
    if (lowerA.includes(left) && lowerB.includes(right)) {
      hits.push(`A says "${left}" while B says "${right}".`);
    }

    if (lowerA.includes(right) && lowerB.includes(left)) {
      hits.push(`A says "${right}" while B says "${left}".`);
    }
  }

  return hits;
}

function scoreRisk(parsedA: ParsedSections, parsedB: ParsedSections) {
  let risk = 0;

  for (const section of REQUIRED_SECTIONS) {
    if (!parsedA[section]) risk += 15;
    if (!parsedB[section]) risk += 15;
  }

  const fireA = parsedA["FIRE LEVEL"].toUpperCase();
  const fireB = parsedB["FIRE LEVEL"].toUpperCase();

  if (fireA.includes("CRITICAL") || fireB.includes("CRITICAL")) risk += 35;
  if (fireA.includes("HIGH") || fireB.includes("HIGH")) risk += 20;
  if (fireA !== fireB) risk += 15;

  return Math.min(risk, 100);
}

function verdictFromRisk(risk: number) {
  if (risk >= 70) return "BLOCKED";
  if (risk >= 35) return "REVIEW";
  return "SAFE TO QUEUE UI ONLY";
}

export default function CleanRoomView() {
  const [input, setInput] = useState("");
  const [responseA, setResponseA] = useState("");
    const [responseB, setResponseB] = useState("");
    const [founderApproved, setFounderApproved] = useState(false);
  const [founderLanguage, setFounderLanguage] = useState("");
  const [companyTranslation, setCompanyTranslation] = useState("");

  const parsedA = useMemo(() => parseSections(responseA), [responseA]);
  const parsedB = useMemo(() => parseSections(responseB), [responseB]);

  const checksA = useMemo(() => sectionCompleteness(parsedA), [parsedA]);
  const checksB = useMemo(() => sectionCompleteness(parsedB), [parsedB]);

  const contradictionsA = useMemo(() => findContradictions(responseA), [responseA]);
  const contradictionsB = useMemo(() => findContradictions(responseB), [responseB]);
  const crossContradictions = useMemo(
    () => deeperContradictionScan(responseA, responseB),
    [responseA, responseB]
  );

  const comparisonRows = REQUIRED_SECTIONS.map((section) => ({
    section,
    a: parsedA[section],
    b: parsedB[section],
    match:
      parsedA[section] &&
      parsedB[section] &&
      parsedA[section].toLowerCase() === parsedB[section].toLowerCase(),
    disagreement:
      parsedA[section] &&
      parsedB[section] &&
      parsedA[section].toLowerCase() !== parsedB[section].toLowerCase(),
  }));

  const disagreementCount = comparisonRows.filter((row) => row.disagreement).length;

  const weightedRisk = useMemo(
    () => Math.min(scoreRisk(parsedA, parsedB) + disagreementCount * 10, 100),
    [parsedA, parsedB, disagreementCount]
  );

  const verdict = verdictFromRisk(weightedRisk);
  const confidence = Math.max(0, 100 - weightedRisk);

  const hasResponses =
    responseA.trim().length > 0 && responseB.trim().length > 0;

  const hasRequiredSections =
    checksA.every((check) => check.status !== "fail") &&
    checksB.every((check) => check.status !== "fail");

  const hasNoCrossContradictions = crossContradictions.length === 0;
  const hasAcceptableDisagreementCount = disagreementCount < 2;

  const gateReasons = [
    !hasResponses ? "Both responses must be present." : "",
    !hasRequiredSections ? "All required sections must be present in both responses." : "",
    !hasNoCrossContradictions ? "Cross-response contradictions must be resolved." : "",
    !hasAcceptableDisagreementCount ? "Too many section disagreements. Review required." : "",
    verdict === "BLOCKED" ? "Verdict is BLOCKED." : "",
  ].filter(Boolean);

  const canShowQueueGate =
    hasResponses &&
    hasRequiredSections &&
    hasNoCrossContradictions &&
    hasAcceptableDisagreementCount &&
    verdict !== "BLOCKED";
  const approvalReady = canShowQueueGate && founderApproved;
  const approvalStatus = !canShowQueueGate
    ? "APPROVAL LOCKED UNTIL CLEAN ROOM GATE PASSES"
    : founderApproved
      ? "FOUNDER APPROVED, UI-ONLY"
      : "WAITING FOR FOUNDER APPROVAL";
  const approvalRequirementsChecklist = [
    {
      label: "Responses present",
      ready: hasResponses,
      detail: hasResponses ? "Both responses are present." : "Response A and Response B are required.",
    },
    {
      label: "Required sections",
      ready: hasRequiredSections,
      detail: hasRequiredSections ? "All required sections are present." : "One or more required sections are missing.",
    },
    {
      label: "Cross contradictions",
      ready: hasNoCrossContradictions,
      detail: hasNoCrossContradictions ? "No cross-response contradictions found." : "Cross-response contradictions must be resolved.",
    },
    {
      label: "Disagreement threshold",
      ready: hasAcceptableDisagreementCount,
      detail: hasAcceptableDisagreementCount ? "Disagreement count is within limit." : "Too many section disagreements.",
    },
    {
      label: "Clean Room verdict",
      ready: verdict !== "BLOCKED",
      detail: verdict !== "BLOCKED" ? "Verdict is not blocked." : "Verdict is BLOCKED.",
    },
  ];
  const queuePayloadPreview = {
    item_type: "clean_room_review",
    boy_name: "UNASSIGNED",
    content: normalizeText(input || responseA || responseB),
    risk_level: weightedRisk >= 70 ? "HIGH" : weightedRisk >= 35 ? "MEDIUM" : "LOW",
    fire_level: parsedA["FIRE LEVEL"] || parsedB["FIRE LEVEL"] || "UNSET",
    rollback_path: "No execution performed. UI-only preview. Restore from latest verified checkpoint if needed.",
    verification_plan: "Founder must confirm gate diagnostics, disagreement count, contradiction scan, and payload preview before any Queue write stage.",
    workflow_status: canShowQueueGate ? "preview_ready" : "blocked_by_clean_room_gate",
  };
  const payloadReadinessChecklist = [
    {
      label: "item_type",
      ready: queuePayloadPreview.item_type.trim().length > 0,
      detail: queuePayloadPreview.item_type,
      problem: queuePayloadPreview.item_type.trim().length > 0 ? "None" : "Missing item_type.",
    },
    {
      label: "boy_name",
      ready: queuePayloadPreview.boy_name.trim().length > 0,
      detail: queuePayloadPreview.boy_name,
      problem: queuePayloadPreview.boy_name.trim().length > 0 ? "None" : "Missing target team member.",
    },
    {
      label: "content",
      ready: queuePayloadPreview.content.trim().length > 0,
      detail: queuePayloadPreview.content ? "Content present" : "Missing content",
      problem: queuePayloadPreview.content.trim().length > 0 ? "None" : "Missing payload content.",
    },
    {
      label: "risk_level",
      ready: queuePayloadPreview.risk_level.trim().length > 0,
      detail: queuePayloadPreview.risk_level,
      problem: queuePayloadPreview.risk_level.trim().length > 0 ? "None" : "Missing risk level.",
    },
    {
      label: "fire_level",
      ready: queuePayloadPreview.fire_level !== "UNSET",
      detail: queuePayloadPreview.fire_level,
      problem: queuePayloadPreview.fire_level !== "UNSET" ? "None" : "Missing FIRE LEVEL section.",
    },
    {
      label: "rollback_path",
      ready: queuePayloadPreview.rollback_path.trim().length > 0,
      detail: "Rollback path present",
      problem: queuePayloadPreview.rollback_path.trim().length > 0 ? "None" : "Missing rollback path.",
    },
    {
      label: "verification_plan",
      ready: queuePayloadPreview.verification_plan.trim().length > 0,
      detail: "Verification plan present",
      problem: queuePayloadPreview.verification_plan.trim().length > 0 ? "None" : "Missing verification plan.",
    },
    {
      label: "workflow_status",
      ready: queuePayloadPreview.workflow_status.trim().length > 0,
      detail: queuePayloadPreview.workflow_status,
      problem: queuePayloadPreview.workflow_status.trim().length > 0 ? "None" : "Missing workflow status.",
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Clean Room
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Controlled Response Comparison
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Safe validation workspace only. No AI calls. No Supabase writes. No
            Drive writes. No Queue inserts.
          </p>
        </header>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Input Panel</h2>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="mt-3 min-h-32 w-full rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-100 outline-none focus:border-amber-400"
            placeholder="Paste the founder request or source instruction here."
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">AI Response A</h2>
            <textarea
              value={responseA}
              onChange={(event) => setResponseA(event.target.value)}
              className="mt-3 min-h-72 w-full rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-100 outline-none focus:border-amber-400"
              placeholder="Paste response A here."
            />
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">AI Response B</h2>
            <textarea
              value={responseB}
              onChange={(event) => setResponseB(event.target.value)}
              className="mt-3 min-h-72 w-full rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-100 outline-none focus:border-amber-400"
              placeholder="Paste response B here."
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">Clean Room Verdict</h2>
            <p className="mt-3 text-3xl font-bold text-amber-300">{verdict}</p>
            <p className="mt-2 text-sm text-neutral-400">
              Confidence: {confidence}%
            </p>
            <p className="text-sm text-neutral-400">
              Weighted risk: {weightedRisk}%
            </p>
            <p className="text-sm text-neutral-400">
              Disagreement Count: {disagreementCount}
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">Heuristic Checks</h2>
            <p className="mt-3 text-sm text-neutral-400">
              Required sections checked for both responses.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Contradiction scan active.
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Queue gate remains UI-only.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">Gated Send to Queue</h2>
            <button
              disabled={!canShowQueueGate}
              className="mt-4 rounded-xl border border-amber-500 px-4 py-3 text-sm font-semibold text-amber-300 disabled:border-neutral-700 disabled:text-neutral-600"
              type="button"
            >
              Send to Queue UI Only
            </button>
            <p className="mt-3 text-xs text-neutral-500">
              Disabled when gate conditions fail. This button does not write anywhere.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Final Queue Readiness Summary</h2>
          <p className="mt-3 text-2xl font-bold text-amber-300">
            {canShowQueueGate ? "READY FOR UI-ONLY QUEUE STEP" : "BLOCKED FROM QUEUE"}
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            This summary does not write to Supabase, Drive, AI, or Queue.
          </p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-neutral-300">
            {(gateReasons.length ? gateReasons : ["All visible gate conditions are passing."]).map(
              (reason) => (
                <li key={reason}>{reason}</li>
              )
            )}
          </ul>
        </section>
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Founder Approval Panel</h2>
          <p className="mt-2 text-sm text-neutral-400">
            UI-only approval control. This does not write to Supabase, Drive, AI, or Queue.
          </p>

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Approval Status
            </p>
            <p className="mt-2 text-lg font-bold text-amber-300">
              {approvalStatus}
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <p className="text-sm font-semibold text-amber-300">
              Approval Requirements Checklist
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {approvalRequirementsChecklist.map((item) => (
                <div key={item.label} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {item.ready ? "PASS" : "BLOCKED"}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <input
              checked={founderApproved}
              disabled={!canShowQueueGate}
              onChange={(event) => setFounderApproved(event.target.checked)}
              type="checkbox"
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-semibold text-neutral-100">
                Founder approves this previewed payload
              </span>
              <span className="mt-1 block text-xs text-neutral-400">
                Disabled until Clean Room gate passes. Approval is local UI state only and does not perform a Queue write.
              </span>
            </span>
          </label>
        </section>
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Approval Record</h2>
          <p className="mt-2 text-sm text-neutral-400">
            UI-only approval summary. This does not save a record, write to Queue, or call Supabase.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Approval Status</p>
              <p className="mt-2 text-sm font-semibold text-amber-300">{approvalStatus}</p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Gate Passed</p>
              <p className="mt-2 text-sm font-semibold">{canShowQueueGate ? "YES" : "NO"}</p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Founder Approved</p>
              <p className="mt-2 text-sm font-semibold">{founderApproved ? "YES" : "NO"}</p>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Record Saved</p>
              <p className="mt-2 text-sm font-semibold">NO</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <p className="text-sm font-semibold text-amber-300">Approval Record Meaning</p>
            <p className="mt-2 text-sm text-neutral-300">
              This screen shows what an approval record would mean later. Nothing has been saved yet.
            </p>
          </div>
        </section>
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Queue Payload Preview</h2>
          <div className="mt-3 rounded-xl border border-amber-500 bg-amber-500/10 p-4">
            <p className="text-sm font-bold uppercase tracking-wide text-amber-300">
              PREVIEW ONLY, NO WRITE PERFORMED
            </p>
            <p className="mt-1 text-xs text-neutral-300">
              This is a dry-run payload preview. It does not write to Supabase, Drive, AI, or Queue.
            </p>
          </div>
          <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-950 p-4 text-sm text-neutral-300">
            {JSON.stringify(queuePayloadPreview, null, 2)}
          </pre>
        </section>
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Payload Readiness Checklist</h2>
          <p className="mt-2 text-sm text-neutral-400">
            UI-only checklist. This confirms whether preview fields are ready before any future Queue write stage.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {payloadReadinessChecklist.map((item) => (
              <div key={item.label} className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <p className="text-xs uppercase tracking-wide text-neutral-500">{item.label}</p>
                <p className="mt-2 text-sm font-semibold">
                  {item.ready ? "READY" : "BLOCKED"}
                </p>
                <p className="mt-1 text-xs text-neutral-400">{item.detail}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  Problem: {item.problem}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Gate Diagnostics</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Responses</p>
              <p className="mt-2 text-sm font-semibold">
                {hasResponses ? "PASS" : "BLOCKED"}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Required Sections</p>
              <p className="mt-2 text-sm font-semibold">
                {hasRequiredSections ? "PASS" : "BLOCKED"}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Cross Contradictions</p>
              <p className="mt-2 text-sm font-semibold">
                {hasNoCrossContradictions ? "PASS" : "BLOCKED"}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Disagreement Threshold</p>
              <p className="mt-2 text-sm font-semibold">
                {hasAcceptableDisagreementCount ? "PASS" : "BLOCKED"}
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Limit: 0-1 disagreements
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-xs uppercase tracking-wide text-neutral-500">Verdict</p>
              <p className="mt-2 text-sm font-semibold">{verdict}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
            <p className="text-sm font-semibold text-amber-300">Block Reasons</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
              {(gateReasons.length ? gateReasons : ["Gate is open. UI-only queue send is available."]).map(
                (reason) => (
                  <li key={reason}>{reason}</li>
                )
              )}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Input Preview</h2>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-neutral-950 p-4 text-sm text-neutral-300">
            {input || "No input yet."}
          </pre>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Section Comparison</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400">
                  <th className="p-3">Section</th>
                  <th className="p-3">Response A</th>
                  <th className="p-3">Response B</th>
                  <th className="p-3">Match</th>
                  <th className="p-3">Disagreement</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.section} className="border-b border-neutral-800">
                    <td className="p-3 font-semibold text-amber-300">
                      {row.section}
                    </td>
                    <td className="p-3 text-neutral-300">
                      {row.a || "Missing"}
                    </td>
                    <td className="p-3 text-neutral-300">
                      {row.b || "Missing"}
                    </td>
                    <td className="p-3">{row.match ? "Exact" : "Review"}</td>
                    <td className="p-3">{row.disagreement ? "YES" : "NO"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">Structured Parsing A</h2>
            <div className="mt-3 space-y-2">
              {checksA.map((check) => (
                <p key={check.label} className="text-sm text-neutral-300">
                  <span className="font-semibold text-amber-300">
                    {check.label}:
                  </span>{" "}
                  {check.status.toUpperCase()} - {check.detail}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
            <h2 className="text-lg font-semibold">Structured Parsing B</h2>
            <div className="mt-3 space-y-2">
              {checksB.map((check) => (
                <p key={check.label} className="text-sm text-neutral-300">
                  <span className="font-semibold text-amber-300">
                    {check.label}:
                  </span>{" "}
                  {check.status.toUpperCase()} - {check.detail}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
          <h2 className="text-lg font-semibold">Contradiction Detection</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div>
              <h3 className="font-semibold text-amber-300">Response A</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                {(contradictionsA.length
                  ? contradictionsA
                  : ["No direct contradiction found."]
                ).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-amber-300">Response B</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                {(contradictionsB.length
                  ? contradictionsB
                  : ["No direct contradiction found."]
                ).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-amber-300">
                Deeper Cross Scan
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                {(crossContradictions.length
                  ? crossContradictions
                  : ["No cross-response contradiction found."]
                ).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}













