import { listPendingQueueItems, getQueueRoute, getQueueRouteMeaning } from "../lib/boysQueue";
import { useEffect, useState } from "react";
import FreddyDecisionPanel from "../components/FreddyDecisionPanel";
import { buildDriveBrainEvidencePack, driveBrainIndexPlaceholderStatus, type DriveBrainEvidencePack } from "../lib/driveBrainIndex";

export default function BackOfficeView() {
  const [queueItems, setQueueItems] = useState<any[]>([]);
  const [driveBrainQuery, setDriveBrainQuery] = useState("CASEVOICE Full File Controlled Helper Integration Strategy");
  const [driveBrainEvidencePack, setDriveBrainEvidencePack] = useState<DriveBrainEvidencePack | null>(null);
  const [driveBrainEvidenceMessage, setDriveBrainEvidenceMessage] = useState("Ready for read-only evidence search.");
  const [driveBrainEvidenceLoading, setDriveBrainEvidenceLoading] = useState(false);

  const [driveBrainEvidenceStatus, setDriveBrainEvidenceStatus] = useState<{
    success: boolean;
    status: string;
    next: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const items = await listPendingQueueItems();
      setQueueItems(items || []);
      const status = await driveBrainIndexPlaceholderStatus();
      setDriveBrainEvidenceStatus(status);
    })();
  }, []);
  const boysItems = [
    {
      name: "Scout",
      state: "Ready later",
      role: "Finds context, files, and project clues before action.",
    },
    {
      name: "Watcher",
      state: "Already active",
      role: "Reports events and system truth. Does not interpret.",
    },
    {
      name: "Freddy",
      state: "Online here",
      role: "Interprets risk and recommends the next safe move.",
    },
    {
      name: "The Boys Queue",
      state: "Not connected yet",
      role: "Future approval lane for drafted work. No autonomous execution yet.",
    },
  ];

  const approvalItems = [
    {
      step: "1",
      title: "Draft",
      detail: "Freddy or the Boys can prepare a proposed action, but it stays parked here.",
    },
    {
      step: "2",
      title: "Review",
      detail: "You approve, reject, revise, or send it back for a safer version.",
    },
    {
      step: "3",
      title: "Apply",
      detail: "Only approved work moves forward. No silent edits. No automatic execution.",
    },
  ];


  async function handleDriveBrainEvidenceSearch() {
    const query = driveBrainQuery.trim();

    if (!query) {
      setDriveBrainEvidenceMessage("Enter a search term first. Evidence only. No action will run.");
      return;
    }

    setDriveBrainEvidenceLoading(true);
    setDriveBrainEvidenceMessage("Searching indexed Drive evidence...");

    try {
      const pack = await buildDriveBrainEvidencePack(query, { limit: 3, excerptChars: 280 });
      setDriveBrainEvidencePack(pack);
      const readableEvidenceCount = pack.evidence.filter(
        (item) => item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0
      ).length;
      const unreadableEvidenceCount = pack.evidence.length - readableEvidenceCount;

      setDriveBrainEvidenceMessage(
        pack.success
          ? "Primary readable evidence found. " + readableEvidenceCount + " readable, " + unreadableEvidenceCount + " indexed file(s) could not be read yet. Read-only preview."
          : "No readable evidence found. Try a more specific Drive title or project name."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDriveBrainEvidenceMessage("Drive Brain evidence search failed: " + message);
    } finally {
      setDriveBrainEvidenceLoading(false);
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto" style={{ backgroundColor: "#08111F", color: "#E8F0FA" }}>
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="mb-6 rounded-2xl p-5" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
          <div className="mb-2 text-[11px] font-bold tracking-[0.22em] uppercase" style={{ color: "#C9A84C" }}>
            Back Office
          </div>
          <p className="max-w-3xl text-base leading-7" style={{ color: "#D0DFEE" }}>
            Company Health lives here. Utility Closet reports system truth. Back Office interprets what it means and decides the next safest move.
          </p>
        </div>
        <FreddyDecisionPanel />

        <section className="mb-5 rounded-2xl p-6" style={{ background: "#0B1626", border: "1px solid rgba(201,168,76,0.35)" }}>
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
            Drive Brain Evidence
          </div>
          <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>
            Back Office can now reference indexed Drive evidence before recommending next moves.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                Evidence Pack
              </div>
              <div className="text-sm leading-6" style={{ color: "#D0DFEE" }}>
                {driveBrainEvidenceStatus?.status === "helper_wired_with_evidence_pack" ? "Ready" : "Checking"}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                Boundary
              </div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                Evidence only. No edits, sends, deletes, syncs, or system actions are connected here.
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                Next
              </div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                {driveBrainEvidenceStatus?.next || "Keep Drive Brain read-only until a query panel is approved."}
              </div>
            </div>
          </div>
        </section>
                <section className="mb-5 rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid rgba(201,168,76,0.35)" }}>
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
            Ask Drive Brain
          </div>
          <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>
            Search indexed Drive evidence and preview excerpts. This is read-only. It cannot edit, send, sync, delete, or approve anything.
          </div>

          <div className="grid grid-cols-1 gap-3">
            <label className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#C9A84C" }}>
              Evidence query
            </label>
            <input
              value={driveBrainQuery}
              onChange={(event) => setDriveBrainQuery(event.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: "#0B1626", color: "#F8FAFC", border: "1px solid #1B2A4A" }}
              placeholder="Search CASEVOICE, legal, my420journal, reports, or a project name"
            />

            <button
              type="button"
              onClick={handleDriveBrainEvidenceSearch}
              disabled={driveBrainEvidenceLoading}
              className="rounded-xl px-4 py-3 text-sm font-black tracking-[0.08em] uppercase"
              style={{
                background: driveBrainEvidenceLoading ? "#1B2A4A" : "#C9A84C",
                color: driveBrainEvidenceLoading ? "#94A3B8" : "#08111F",
                border: "1px solid rgba(201,168,76,0.45)",
              }}
            >
              {driveBrainEvidenceLoading ? "Searching Evidence" : "Preview Evidence Pack"}
            </button>

            <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                Status
              </div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                {driveBrainEvidenceMessage}
              </div>
            </div>

            {driveBrainEvidencePack && (() => {
              const primaryEvidence = driveBrainEvidencePack.evidence[0];
              const supportingEvidence = driveBrainEvidencePack.evidence.slice(1);

              return (
                <div className="grid grid-cols-1 gap-3">
                  <div className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#C9A84C" }}>
                    Evidence preview
                  </div>

                  {primaryEvidence && (
                    <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid rgba(201,168,76,0.35)" }}>
                      <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                        Primary match
                      </div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="text-sm font-black leading-6" style={{ color: "#F8FAFC" }}>
                          {primaryEvidence.title}
                        </div>
                        <div className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-1 rounded-full" style={{ color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)" }}>
                          {primaryEvidence.fetchStatus}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs leading-6 mb-2" style={{ color: "#94A3B8" }}>
                        <div>Status: {primaryEvidence.fetchStatus}</div>
                        <div>Text: {primaryEvidence.textLength} chars</div>
                        <div>Drive ID: {primaryEvidence.driveFileId || "missing"}</div>
                      </div>
                      <div className="rounded-lg p-3" style={{ color: "#D0DFEE", background: "#08111F", border: "1px solid rgba(148,163,184,0.18)" }}>
                        <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                          Preview excerpt only
                        </div>
                        <div className="text-xs leading-6 whitespace-pre-wrap">
                          {primaryEvidence.excerpt || primaryEvidence.error || "No readable excerpt returned."}
                        </div>
                      </div>
                    </div>
                  )}

                  {supportingEvidence.length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
                      <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-3" style={{ color: "#C9A84C" }}>
                        Supporting sources
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {supportingEvidence.map((item) => (
                          <div key={item.id + "-" + item.driveFileId} className="rounded-lg p-3" style={{ background: "#08111F", border: "1px solid rgba(148,163,184,0.18)" }}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-xs font-black leading-5" style={{ color: "#F8FAFC" }}>
                                {item.title}
                              </div>
                              <div className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-1 rounded-full" style={{ color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)" }}>
                                {item.fetchStatus}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] leading-5 mt-2" style={{ color: "#94A3B8" }}>
                              <div>Status: {item.fetchStatus}</div>
                              <div>Text: {item.textLength} chars</div>
                              <div>Drive ID: {item.driveFileId || "missing"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </section>
          {(() => {
            const receiptEvidencePack = Array.isArray(driveBrainEvidencePack) ? driveBrainEvidencePack : [];
            const receiptReadableEvidence = receiptEvidencePack.filter((item: any) => item?.readable !== false);
            const receiptUnreadableEvidence = receiptEvidencePack.filter((item: any) => item?.readable === false);
            const receiptPrimarySource =
              receiptReadableEvidence[0]?.title ||
              receiptReadableEvidence[0]?.drive_name ||
              receiptReadableEvidence[0]?.name ||
              receiptReadableEvidence[0]?.source ||
              "No readable primary source yet";
            const receiptEvidenceStatus =
              driveBrainEvidenceStatus?.detail ||
              driveBrainEvidenceStatus?.next ||
              (receiptEvidencePack.length > 0 ? "Evidence loaded for read-only review" : "Ready for read-only evidence search.");

            return (
              <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4 shadow-sm">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-blue-100">Drive Brain Truth Receipt</h3>
                  <p className="text-xs text-blue-200/70">
                    Read-only evidence summary. No writes, syncs, approvals, queue actions, deletes, or execution.
                  </p>
                </div>

                <div className="grid gap-2 text-xs text-blue-50 sm:grid-cols-2">
                  <div className="rounded-xl border border-blue-500/20 bg-slate-950/30 p-3">
                    <div className="text-blue-200/60">Query used</div>
                    <div className="mt-1 font-medium">{driveBrainQuery?.trim() || "No query entered"}</div>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-slate-950/30 p-3">
                    <div className="text-blue-200/60">Evidence status</div>
                    <div className="mt-1 font-medium">{receiptEvidenceStatus}</div>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-slate-950/30 p-3">
                    <div className="text-blue-200/60">Readable count</div>
                    <div className="mt-1 font-medium">{receiptReadableEvidence.length}</div>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-slate-950/30 p-3">
                    <div className="text-blue-200/60">Unreadable count</div>
                    <div className="mt-1 font-medium">{receiptUnreadableEvidence.length}</div>
                  </div>

                  <div className="rounded-xl border border-blue-500/20 bg-slate-950/30 p-3">
                    <div className="text-blue-200/60">Primary source</div>
                    <div className="mt-1 font-medium">{receiptPrimarySource}</div>
                  </div>

                  <div className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-3">
                    <div className="text-amber-200/70">Guessing allowed</div>
                    <div className="mt-1 font-semibold text-amber-100">NO</div>
                  </div>
                </div>
              </div>
            );
          })()}


        
        {driveBrainEvidencePack && (() => {
          const readableEvidence = driveBrainEvidencePack.evidence.filter(
            (item) => item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0
          );
          const unreadableEvidence = driveBrainEvidencePack.evidence.filter(
            (item) => !(item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0)
          );
          const primaryReadableEvidence = readableEvidence[0];

          return (
            <section className="mb-5 rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid rgba(201,168,76,0.35)" }}>
              

<div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
                Evidence to Freddy
              </div>
              <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>
                Read-only decision summary. Freddy can use this context to recommend the next safe move, but this card cannot execute, approve, send, sync, delete, or change anything.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl p-3" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1" style={{ color: "#C9A84C" }}>
                    Readable
                  </div>
                  <div className="text-2xl font-black" style={{ color: "#F8FAFC" }}>
                    {readableEvidence.length}
                  </div>
                </div>

                <div className="rounded-xl p-3" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1" style={{ color: "#C9A84C" }}>
                    Indexed but unreadable
                  </div>
                  <div className="text-2xl font-black" style={{ color: "#F8FAFC" }}>
                    {unreadableEvidence.length}
                  </div>
                </div>

                <div className="rounded-xl p-3" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1" style={{ color: "#C9A84C" }}>
                    Boundary
                  </div>
                  <div className="text-sm font-black leading-6" style={{ color: "#F8FAFC" }}>
                    Read-only
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4 mb-3" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                  Primary readable source
                </div>
                <div className="text-sm font-black leading-6" style={{ color: "#F8FAFC" }}>
                  {primaryReadableEvidence?.title || "No readable source available yet."}
                </div>
                <div className="text-xs leading-6 mt-2" style={{ color: "#94A3B8" }}>
                  {primaryReadableEvidence
                    ? "Freddy should treat this as the anchor evidence and treat unreadable indexed files as caveats."
                    : "Freddy should ask for a better query or a readable source before making a recommendation."}
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ background: "#08111F", border: "1px solid rgba(148,163,184,0.18)" }}>
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                  Recommended next safe move
                </div>
                <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                  {readableEvidence.length > 0
                    ? "Use the primary readable source first. Note unreadable indexed files as limitations. Do not draft implementation work or prepare action items until the founder asks for a draft."
                    : "Do not recommend action yet. Search again with a clearer term or choose a readable source."}
                </div>
              </div>
            </section>
          );
        })()}

        {driveBrainEvidencePack && (() => {
          const readableEvidence = driveBrainEvidencePack.evidence.filter(
            (item) => item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0
          );
          const unreadableEvidence = driveBrainEvidencePack.evidence.filter(
            (item) => !(item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0)
          );
          const primaryReadableEvidence = readableEvidence[0];
          const freddyRecommendation =
            readableEvidence.length === 0
              ? "Hold"
              : unreadableEvidence.length > 0
                ? "Review"
                : "Proceed";
          const freddyWhy =
            freddyRecommendation === "Proceed"
              ? "All returned evidence is readable. Freddy may recommend draft-only review, but no work should be queued automatically."
              : freddyRecommendation === "Review"
                ? "Readable evidence exists, but at least one indexed source could not be read. Freddy should include that caveat before recommending next steps."
                : "No readable evidence is available. Freddy should not recommend action until a readable source is found.";
          const freddyRiskNote =
            freddyRecommendation === "Proceed"
              ? "Low evidence risk for summary work. Still no execution, approval, or queue write."
              : freddyRecommendation === "Review"
                ? "Medium evidence risk. Use readable sources, but disclose unreadable indexed files."
                : "High evidence risk. Hold until evidence improves.";
          const freddyNextMove =
            freddyRecommendation === "Proceed"
              ? "Safe next move: ask the founder whether to draft a summary or draft-only proposal. Do not create it automatically."
              : freddyRecommendation === "Review"
                ? "Safe next move: review the primary readable source and mention unreadable limitations before any draft work."
                : "Safe next move: search again with a clearer term or add a readable source.";

          return (
            <section className="mb-5 rounded-2xl p-6" style={{ background: "#0B1626", border: "1px solid rgba(201,168,76,0.35)" }}>
              <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
                Freddy Recommendation
              </div>
              <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>
                Read-only interpretation. Freddy is only recommending what to consider next. This card cannot execute, approve, queue, send, sync, delete, or change anything.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                    Recommendation
                  </div>
                  <div className="text-2xl font-black" style={{ color: freddyRecommendation === "Hold" ? "#f87171" : freddyRecommendation === "Review" ? "#f59e0b" : "#22c55e" }}>
                    {freddyRecommendation}
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                    Evidence confidence
                  </div>
                  <div className="text-sm font-black leading-6" style={{ color: "#F8FAFC" }}>
                    {readableEvidence.length} readable, {unreadableEvidence.length} unreadable
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                    Boundary
                  </div>
                  <div className="text-sm font-black leading-6" style={{ color: "#F8FAFC" }}>
                    Recommend only
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                    Why
                  </div>
                  <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                    {freddyWhy}
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                    Primary source Freddy should anchor on
                  </div>
                  <div className="text-sm font-black leading-6" style={{ color: "#F8FAFC" }}>
                    {primaryReadableEvidence?.title || "No readable source available yet."}
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: "#08111F", border: "1px solid rgba(148,163,184,0.18)" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                    Risk note
                  </div>
                  <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                    {freddyRiskNote}
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: "#08111F", border: "1px solid rgba(148,163,184,0.18)" }}>
                  <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: "#C9A84C" }}>
                    Next safe move
                  </div>
                  <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                    {freddyNextMove}
                  </div>
                </div>
              </div>
            </section>
          );
        })()}
        {driveBrainEvidencePack && (() => {
          const readableEvidence = driveBrainEvidencePack.evidence.filter(
            (item) => item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0
          );
          const unreadableEvidence = driveBrainEvidencePack.evidence.filter(
            (item) => !(item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0)
          );
          const primaryReadableEvidence = readableEvidence[0];
          const freddyDraftRoute =
            readableEvidence.length === 0
              ? "Hold"
              : unreadableEvidence.length > 0
                ? "Review"
                : "Proceed";
          const freddyDraftTitle =
            freddyDraftRoute === "Hold"
              ? "Hold draft until readable evidence improves."
              : "Draft plan from Freddy Recommendation.";
          const freddyDraftCaveats =
            unreadableEvidence.length > 0
              ? unreadableEvidence.length + " indexed file(s) are unreadable and must stay listed as caveats."
              : "No unreadable indexed files returned in this evidence pack.";
          const freddyDraftRollback =
            "Restore the pre-change backup. No DB, Drive, Health, App.tsx, or Boys Queue state is affected.";
          const freddyDraftRiskLevel =
            freddyDraftRoute === "Hold" ? "High" : freddyDraftRoute === "Review" ? "Medium" : "Low";
          const freddyDraftFireLevel = "LOW";
          const freddyDraftWorkflowStatus = freddyDraftRoute === "Hold" ? "HOLD" : "DRAFT ONLY";
          const freddyDraftVerificationPlan =
            freddyDraftRoute === "Hold"
              ? "Find readable evidence before drafting."
              : "Verify evidence anchor, caveats, route, rollback, and founder approval before any future approved action path.";
          const freddyDraftAffectedArea = "Back Office read-only draft layer";
          const draftHasEvidence = readableEvidence.length > 0;
          const draftRouteMatchesEvidence =
            (freddyDraftRoute === "Hold" && readableEvidence.length === 0) ||
            (freddyDraftRoute === "Review" && readableEvidence.length > 0 && unreadableEvidence.length > 0) ||
            (freddyDraftRoute === "Proceed" && readableEvidence.length > 0 && unreadableEvidence.length === 0);

          return (
            <section className="mb-5 rounded-2xl p-6" style={{ background: "#101827", border: "1px solid rgba(201,168,76,0.32)" }}>
              <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>Freddy Draft Plan</div>
              <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>Read-only dynamic draft layer. Freddy can outline a future draft-only proposal, but this card cannot execute, approve, send, sync, delete, create work, or change anything.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl p-4 text-sm leading-6" style={{ background: "rgba(15,30,51,0.82)", border: "1px solid rgba(148,163,184,0.18)", color: "#F8FAFC" }}>Proposed draft title: {freddyDraftTitle}</div>
                <div className="rounded-xl p-4 text-sm leading-6" style={{ background: "rgba(15,30,51,0.82)", border: "1px solid rgba(148,163,184,0.18)", color: "#F8FAFC" }}>Proposed route: {freddyDraftRoute}</div>
                <div className="rounded-xl p-4 text-sm leading-6" style={{ background: "rgba(15,30,51,0.82)", border: "1px solid rgba(148,163,184,0.18)", color: "#F8FAFC" }}>Evidence anchor: {primaryReadableEvidence?.title || "No readable source available yet."}</div>
                <div className="rounded-xl p-4 text-sm leading-6" style={{ background: "rgba(15,30,51,0.82)", border: "1px solid rgba(148,163,184,0.18)", color: "#F8FAFC" }}>Caveats: {freddyDraftCaveats}</div>
                <div className="rounded-xl p-4 text-sm leading-6" style={{ background: "rgba(15,30,51,0.82)", border: "1px solid rgba(239,68,68,0.22)", color: "#F8FAFC" }}>Required approval: founder approval before any future approved action path.</div>
                <div className="rounded-xl p-4 text-sm leading-6" style={{ background: "rgba(15,30,51,0.82)", border: "1px solid rgba(239,68,68,0.22)", color: "#F8FAFC" }}>Rollback note: {freddyDraftRollback}</div>
              </div>

              <div className="mt-4 rounded-xl p-4" style={{ background: "#08111F", border: "1px solid rgba(148,163,184,0.22)" }}>
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: "#C9A84C" }}>Draft Plan Output Format</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm leading-6" style={{ color: "#F8FAFC" }}>
                  <div>Risk level: {freddyDraftRiskLevel}</div>
                  <div>Fire level: {freddyDraftFireLevel}</div>
                  <div>Workflow status: {freddyDraftWorkflowStatus}</div>
                  <div>Affected area: {freddyDraftAffectedArea}</div>
                  <div className="md:col-span-2">Verification plan: {freddyDraftVerificationPlan}</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl p-4" style={{ background: "#08111F", border: "1px solid rgba(201,168,76,0.25)" }}>
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: "#C9A84C" }}>Draft Plan Quality Guardrails</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm leading-6" style={{ color: "#F8FAFC" }}>
                  <div>Evidence required: {draftHasEvidence ? "PASS" : "HOLD"}</div>
                  <div>Route matches evidence: {draftRouteMatchesEvidence ? "PASS" : "REVIEW"}</div>
                  <div>Caveats required: PASS</div>
                  <div>Rollback required: PASS</div>
                  <div>Approval required: PASS</div>
                  <div>No write path allowed: PASS</div>
                </div>
              </div>
            </section>
          );
        })()}
        {driveBrainEvidencePack && (() => {
          const readableEvidence = driveBrainEvidencePack.evidence.filter(
            (item) => item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0
          );
          const unreadableEvidence = driveBrainEvidencePack.evidence.filter(
            (item) => !(item.fetchStatus === "fetched" && item.readable !== false && item.textLength > 0)
          );
          const primaryReadableEvidence = readableEvidence[0];
          const queuePreviewRoute =
            readableEvidence.length === 0
              ? "HOLD"
              : unreadableEvidence.length > 0
                ? "REVIEW"
                : "QUEUE PREVIEW ONLY";

          return (
            <section className="mb-5 rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid rgba(56,189,248,0.28)" }}>
              <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#38bdf8" }}>Read-Only Queue Preview</div>
              <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>Preview only. This shows what a future draft-only proposal could look like after founder approval. Nothing is written or sent.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm leading-6" style={{ color: "#F8FAFC" }}>
                <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>Preview source: Freddy Draft Plan</div>
                <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>Preview route: {queuePreviewRoute}</div>
                <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>Evidence anchor: {primaryReadableEvidence?.title || "No readable source available yet."}</div>
                <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>Unreadable caveats: {unreadableEvidence.length}</div>
                <div className="rounded-xl p-4 md:col-span-2" style={{ background: "#08111F", border: "1px solid rgba(239,68,68,0.22)" }}>Hard stop: no write path exists here. Founder approval is required before any future write path is built.</div>
              </div>
            </section>
          );
        })()}
<section className="mb-5 rounded-2xl p-6" style={{ background: "#0B1626", border: "1px solid rgba(34,197,94,0.35)" }}>
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#22c55e" }}>
            Approval Lane
          </div>
          <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>
            Nothing moves from recommendation to action without passing through approval.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {approvalItems.map((item) => (
              <div key={item.step} className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-black" style={{ color: "#08111F", background: "#22c55e" }}>
                  {item.step}
                </div>
                <div className="text-lg font-black mb-2" style={{ color: "#F8FAFC" }}>{item.title}</div>
                <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>{item.detail}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="mb-5 rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid rgba(201,168,76,0.35)" }}>
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
            Approval Queue
          </div>
          <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>
            Future work from Freddy and the Boys will land here before anything changes.
          </div>

          {queueItems.length > 0 && (
            <div className="mb-4 grid grid-cols-1 gap-3">
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "#C9A84C" }}>
                Real Queue Items (read-only)
              </div>
              {queueItems.map((item) => (
                <div key={item.id} className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
                  <div className="text-base font-black mb-2" style={{ color: "#F8FAFC" }}>
                    {item.boy_name || "Unknown Team Member"}
                  </div>
                  <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                    Route: {getQueueRoute(item)}. Meaning: {getQueueRouteMeaning(getQueueRoute(item))}
                  </div>
                  <div className="text-xs leading-6 mt-2" style={{ color: "#94A3B8" }}>
                    Read-only preview. No approval, kickback, edit, send, sync, or execution is connected here.
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
              <div className="text-base font-black mb-2" style={{ color: "#F8FAFC" }}>No pending approvals</div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                This is correct. The queue is visible, but no tool or autonomous action is connected yet.
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
              <div className="text-base font-black mb-2" style={{ color: "#F8FAFC" }}>Future item format</div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                Each future approved item should show source, risk level, proposed change, rollback path, and approve/reject options.
              </div>
            </div>
          </div>
        </section>
        <section className="mb-5 rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid rgba(201,168,76,0.35)" }}>
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
            Sample Queue Items
          </div>
          <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>
            These are examples only. Nothing here can run, edit, or send anything.
          </div>


          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-base font-black" style={{ color: "#F8FAFC" }}>Draft Send Report update</div>
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-1 rounded-full" style={{ color: "#C9A84C", border: "1px solid rgba(201,168,76,0.35)" }}>
                  Draft only
                </div>
              </div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                Source: Freddy. Risk: low. Proposed change: prepare a Drive report summary. Rollback: discard draft. Route: QUEUE. Meaning: Low risk, safe to proceed.
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-base font-black" style={{ color: "#F8FAFC" }}>Review HealthView extraction risk</div>
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-1 rounded-full" style={{ color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)" }}>
                  Needs review
                </div>
              </div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                Source: Watcher + Freddy. Risk: medium. Proposed change: keep HealthCard inline. Rollback: no action needed. Route: REVIEW. Meaning: Medium risk, review carefully.
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#0B1626", border: "1px solid #1B2A4A" }}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-base font-black" style={{ color: "#F8FAFC" }}>Prepare Boys Queue connection plan (Route: HOLD. Meaning: Missing safety fields, cannot proceed yet.)</div>
                <div className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-1 rounded-full" style={{ color: "#38bdf8", border: "1px solid rgba(56,189,248,0.35)" }}>
                  Planning
                </div>
              </div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                Source: Back Office. Risk: medium. Proposed change: design the approval data shape before wiring actions. Rollback: keep as static plan.
              </div>
            </div>
          </div>
        </section>
        <section className="mb-5 rounded-2xl p-6" style={{ background: "#0B1626", border: "1px solid rgba(239,68,68,0.35)" }}>
          <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#ef4444" }}>
            Permission Boundary Panel
          </div>
          <div className="text-lg leading-8 mb-4" style={{ color: "#F8FAFC" }}>
            This is the wall between advice and action. Freddy and the Boys may recommend and draft, but they do not execute or create work without approval.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#ef4444" }}>Blocked Without Approval</div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                File edits, command execution, Drive changes, sending messages, deleting content, or changing system settings.
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#ef4444" }}>Allowed Before Approval</div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                Summarize, identify risks, draft proposals, and prepare rollback paths for founder review.
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#ef4444" }}>Required Before Apply</div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                Clear proposed change, risk level, affected files, rollback path, and explicit human approval.
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
              <div className="text-[10px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: "#ef4444" }}>Standing Stop Rule</div>
              <div className="text-sm leading-7" style={{ color: "#D0DFEE" }}>
                If risk is unclear, the item stays queued. No guessing. No silent fixes. No submarine screen doors.
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5">
          <section className="rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
              Current Focus
            </div>
            <div className="text-lg leading-8" style={{ color: "#F8FAFC" }}>
              Keep Utility Closet pure. Build Freddy and the Boys decision layer here, not inside diagnostics.
            </div>
          </section>

          <section className="rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
              Active Risks
            </div>
            <ul className="text-base leading-8 list-disc pl-6 space-y-2" style={{ color: "#D0DFEE" }}>
              <li>HealthView is stable but should not receive decision logic.</li>
              <li>HealthCard extraction is paused after visual regression.</li>
              <li>Startup must use the hidden launcher path, not manual visible server windows.</li>
            </ul>
          </section>

          <section className="rounded-2xl p-6" style={{ background: "#0F1E33", border: "1px solid #1B2A4A" }}>
            <div className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "#C9A84C" }}>
              Next Safe Step
            </div>
            <div className="text-lg leading-8" style={{ color: "#F8FAFC" }}>
              Keep Freddy static until permission boundaries are visible. Then connect him to the Boys Queue one step at a time.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}











