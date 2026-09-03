import { useEffect, useMemo, useRef, useState } from "react";
import { FileImage, Link2, Mic, MicOff, Search, ShieldCheck } from "lucide-react";
import {
  analyzeFoundryIdea,
  listFoundryCards,
  recordFoundryDecision,
  type FoundryCard,
  type FoundryDecision,
} from "../lib/foundry";
import { getCurrentCanonContext } from "../lib/casevoiceKnowledge";

const GOLD = "#C9A84C";
const BORDER = "#1B2A4A";
const BG = "#08111F";
const CARD = "#0D1B2E";
const TEXT = "#D0DFEE";
const MUTED = "#8A9BB5";

const recommendationTone: Record<string, string> = {
  TEST: "#4ADE80",
  HOLD: "#F59E0B",
  KILL: "#F87171",
};

function compact(value: string, max = 150) {
  return value.length > max ? `${value.slice(0, max).trim()}…` : value;
}

export default function FoundryView() {
  const [rawInput, setRawInput] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [cards, setCards] = useState<FoundryCard[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const selected = useMemo(
    () => cards.find((card) => card.id === selectedId) ?? cards.find((card) => card.lifecycle === "TESTABLE") ?? cards[0] ?? null,
    [cards, selectedId]
  );
  const decisionCount = cards.filter((card) => card.lifecycle === "TESTABLE").length;

  async function refresh(preferId?: string) {
    const next = await listFoundryCards();
    setCards(next);
    if (preferId) setSelectedId(preferId);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load Foundry."));
    return () => recognitionRef.current?.stop?.();
  }, []);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Voice capture is not available in this browser. Type or paste the thought instead.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      let spoken = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) spoken += `${event.results[i][0].transcript} `;
      }
      if (spoken.trim()) setRawInput((current) => `${current}${current ? " " : ""}${spoken.trim()}`);
    };
    recognition.onerror = () => {
      setListening(false);
      setError("Voice capture stopped. Your existing text is safe.");
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
    setError("");
  }

  async function submitIdea() {
    if (!rawInput.trim()) {
      setError("Dump the thought first. No form required.");
      return;
    }
    setBusy(true);
    setError("");
    setShowAnalysis(false);
    try {
      const card = await analyzeFoundryIdea({
        rawInput,
        sourceUrl,
        image,
        canonContext: getCurrentCanonContext(),
      });
      setRawInput("");
      setSourceUrl("");
      setImage(null);
      await refresh(card.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Foundry analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: FoundryDecision) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const updated = await recordFoundryDecision(selected, decision);
      setCards((current) => current.map((card) => (card.id === updated.id ? updated : card)));
      setSelectedId(updated.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the Foundry decision.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6" style={{ backgroundColor: BG, color: "#FFFFFF" }}>
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>VOGTCOM FOUNDRY</p>
            <h1 className="mt-2 text-2xl font-bold">Unlimited ideas. Limited simultaneous execution.</h1>
            <p className="mt-2 max-w-3xl text-sm" style={{ color: MUTED }}>
              Dump the thought. AI handles the research packet. Nothing becomes an active project until you promote it.
            </p>
          </div>
          <div className="rounded-xl border px-4 py-3 text-right" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>FOUNDRY DECISIONS</div>
            <div className="mt-1 text-2xl font-bold" style={{ color: decisionCount ? GOLD : "#4ADE80" }}>{decisionCount}</div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border p-5" style={{ borderColor: BORDER, backgroundColor: CARD }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Brain dump</h2>
              <p className="mt-1 text-xs" style={{ color: MUTED }}>One sentence is enough. Swearing, fragments, pasted notes, and half-formed ideas are allowed.</p>
            </div>
            <button
              type="button"
              onClick={toggleVoice}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"
              style={{ borderColor: listening ? "#F87171" : BORDER, color: listening ? "#F87171" : TEXT }}
            >
              {listening ? <MicOff size={14} /> : <Mic size={14} />}
              {listening ? "STOP" : "VOICE"}
            </button>
          </div>
          <textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            className="mt-4 min-h-32 w-full rounded-xl border p-4 text-sm outline-none"
            style={{ borderColor: BORDER, backgroundColor: BG, color: TEXT }}
            placeholder="Why the fuck doesn't somebody make X?"
          />
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ borderColor: BORDER, backgroundColor: BG }}>
              <Link2 size={14} style={{ color: MUTED }} />
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: TEXT }}
                placeholder="Optional URL"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: BORDER, backgroundColor: BG, color: image ? TEXT : MUTED }}>
              <FileImage size={14} />
              <span className="truncate">{image ? image.name : "Optional screenshot / image"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px]" style={{ color: MUTED }}>
              <ShieldCheck size={14} />
              Research does not authorize spend, outreach, development, or Canon changes.
            </div>
            <button
              type="button"
              disabled={busy || !rawInput.trim()}
              onClick={submitIdea}
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold disabled:opacity-40"
              style={{ backgroundColor: GOLD, color: "#08111F" }}
            >
              <Search size={14} />
              {busy ? "RESEARCHING…" : "RESEARCH IDEA"}
            </button>
          </div>
          {error && <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#F87171", color: "#FCA5A5" }}>{error}</div>}
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.6fr]">
          <section className="rounded-2xl border p-4" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>IDEA VAULT</div>
            <div className="space-y-2">
              {cards.length === 0 && <div className="rounded-xl border p-4 text-sm" style={{ borderColor: BORDER, color: MUTED }}>No Foundry cards yet.</div>}
              {cards.map((card) => (
                <button
                  type="button"
                  key={card.id}
                  onClick={() => { setSelectedId(card.id); setShowAnalysis(false); }}
                  className="w-full rounded-xl border p-3 text-left"
                  style={{ borderColor: selected?.id === card.id ? GOLD : BORDER, backgroundColor: BG }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold" style={{ color: TEXT }}>{card.title}</div>
                    <div className="text-[9px] font-bold uppercase" style={{ color: recommendationTone[card.recommendation] ?? MUTED }}>{card.recommendation}</div>
                  </div>
                  <div className="mt-2 text-[11px]" style={{ color: MUTED }}>{compact(card.problem, 95)}</div>
                  <div className="mt-2 text-[9px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>{card.lifecycle}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border p-5" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            {!selected ? (
              <div className="py-12 text-center text-sm" style={{ color: MUTED }}>Your next decision will appear here.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>FOUNDRY DECISION</div>
                    <h2 className="mt-2 text-xl font-bold">{selected.title}</h2>
                  </div>
                  <div className="rounded-lg border px-3 py-2 text-sm font-bold" style={{ borderColor: recommendationTone[selected.recommendation], color: recommendationTone[selected.recommendation] }}>
                    AI: {selected.recommendation} · {selected.score}/100
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border p-4" style={{ borderColor: BORDER, backgroundColor: BG }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>WHY</div>
                    <div className="mt-2 text-sm leading-relaxed" style={{ color: TEXT }}>{selected.recommendation_reason}</div>
                  </div>
                  <div className="rounded-xl border p-4" style={{ borderColor: BORDER, backgroundColor: BG }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>SMALLEST TEST</div>
                    <div className="mt-2 text-sm leading-relaxed" style={{ color: TEXT }}>{selected.smallest_test}</div>
                    <div className="mt-3 text-xs" style={{ color: MUTED }}>Cash: {selected.estimated_cash} · Founder time: {selected.estimated_founder_time}</div>
                  </div>
                </div>

                {selected.duplicate_of && (
                  <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: "#F59E0B", color: "#FBBF24", backgroundColor: "rgba(245,158,11,0.06)" }}>
                    Possible duplicate: {selected.duplicate_of}. {selected.duplicate_reason}
                  </div>
                )}

                {selected.lifecycle === "TESTABLE" ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => decide("TEST")} className="rounded-xl px-4 py-3 text-xs font-bold disabled:opacity-40" style={{ backgroundColor: "#4ADE80", color: BG }}>APPROVE TEST</button>
                    <button type="button" disabled={busy} onClick={() => decide("HOLD")} className="rounded-xl border px-4 py-3 text-xs font-bold disabled:opacity-40" style={{ borderColor: "#F59E0B", color: "#FBBF24" }}>HOLD</button>
                    <button type="button" disabled={busy} onClick={() => decide("KILL")} className="rounded-xl border px-4 py-3 text-xs font-bold disabled:opacity-40" style={{ borderColor: "#F87171", color: "#FCA5A5" }}>KILL</button>
                    <button type="button" onClick={() => setShowAnalysis((value) => !value)} className="rounded-xl border px-4 py-3 text-xs font-bold" style={{ borderColor: BORDER, color: TEXT }}>{showAnalysis ? "HIDE ANALYSIS" : "READ ANALYSIS"}</button>
                  </div>
                ) : (
                  <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border p-4" style={{ borderColor: BORDER, backgroundColor: BG }}>
                    <div>
                      <div className="text-xs font-bold" style={{ color: GOLD }}>DECISION RECORDED: {selected.decision || selected.lifecycle}</div>
                      <div className="mt-1 text-xs" style={{ color: MUTED }}>Stored in the Decision Log. Canon unchanged. No active project was created.</div>
                    </div>
                    <button type="button" onClick={() => setShowAnalysis((value) => !value)} className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: BORDER, color: TEXT }}>{showAnalysis ? "HIDE" : "READ ANALYSIS"}</button>
                  </div>
                )}

                {showAnalysis && (
                  <div className="mt-5 space-y-4 rounded-xl border p-4" style={{ borderColor: BORDER, backgroundColor: BG }}>
                    {[
                      ["Observation", selected.observation],
                      ["Problem", selected.problem],
                      ["Proposed solution", selected.proposed_solution],
                      ["Potential customer", selected.potential_customer],
                      ["Money hypothesis", selected.money_hypothesis],
                      ["Vogtcom connection", selected.vogtcom_connection],
                      ["Potential upside", selected.potential_upside],
                      ["Success trigger", selected.success_trigger],
                      ["Kill trigger", selected.kill_trigger],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>{label}</div>
                        <div className="mt-1 text-sm leading-relaxed" style={{ color: TEXT }}>{value}</div>
                      </div>
                    ))}
                    {[
                      ["Existing alternatives", selected.existing_alternatives],
                      ["Evidence for", selected.evidence_for],
                      ["Evidence against", selected.evidence_against],
                      ["Unknowns", selected.unknowns],
                      ["Primary risks", selected.primary_risks],
                    ].map(([label, values]) => (
                      <div key={label as string}>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>{label as string}</div>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm" style={{ color: TEXT }}>
                          {(values as string[]).map((value) => <li key={value}>{value}</li>)}
                        </ul>
                      </div>
                    ))}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>AI TEAM</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {selected.workers.map((worker) => (
                          <div key={`${worker.role}-${worker.finding}`} className="rounded-lg border p-3 text-xs" style={{ borderColor: BORDER }}>
                            <div className="font-bold" style={{ color: GOLD }}>{worker.role}</div>
                            <div className="mt-1" style={{ color: TEXT }}>{worker.finding}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selected.sources.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>RESEARCH SOURCES</div>
                        <div className="mt-2 space-y-1">
                          {selected.sources.map((source) => (
                            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block text-xs underline" style={{ color: "#60A5FA" }}>{source.title || source.url}</a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        <div className="mt-5 rounded-xl border px-4 py-3 text-[11px]" style={{ borderColor: BORDER, color: MUTED }}>
          Truth layers stay separate: CANON = current company truth. DECISION LOG = why a decision changed state. EOD = historical evidence only. Foundry research never edits Canon automatically.
        </div>
      </div>
    </div>
  );
}
