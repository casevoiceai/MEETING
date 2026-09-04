import { useEffect, useMemo, useRef, useState } from "react";
import { FileImage, Link2, Mic, MicOff, Search, ShieldCheck } from "lucide-react";
import {
  analyzeFoundryIdea,
  listFoundryCards,
  recordFoundryDecision,
  transcribeFoundryAudio,
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
const LIVE_CHUNK_MS = 4000;
const READINESS_STAGES = ["BRAIN DUMP", "DESIGN EXERCISE", "VALIDATE", "TESTABLE", "PROMOTION CANDIDATE"] as const;

type VaultFilter = "ACTIVE" | "HOLD" | "KILL" | "ALL";

type ReadinessCoach = {
  status: string;
  heading: string;
  why: string;
  questions: string[];
  proof: string;
};

const recommendationTone: Record<string, string> = {
  TEST: "#4ADE80",
  HOLD: "#F59E0B",
  KILL: "#F87171",
};

function compact(value: string, max = 150) {
  return value.length > max ? `${value.slice(0, max).trim()}…` : value;
}

function readinessIndex(card: FoundryCard): number {
  if (card.lifecycle === "PROMOTE" || (card.lifecycle === "EVIDENCE" && card.score >= 75)) return 4;
  if (card.score >= 60 || card.recommendation === "TEST") return 3;
  if (card.score >= 40) return 2;
  if (card.score >= 20) return 1;
  return 0;
}

function readinessMeaning(index: number): string {
  if (index === 0) return "Interesting thought only. The evidence is not strong enough to treat this as project work.";
  if (index === 1) return "Worth thinking through, but this is still closer to a design exercise than a business commitment.";
  if (index === 2) return "Plausible opportunity. Get cheap external evidence before spending build time.";
  if (index === 3) return "Enough evidence exists for a bounded test. This still does not authorize a build or new project.";
  return "Evidence is strong enough to consider formal promotion. Daniel still makes the promotion decision.";
}

function readinessCoach(card: FoundryCard, targetIndex: number, currentIndex: number): ReadinessCoach {
  const biggestUnknown = card.unknowns?.[0] || "The most important remaining assumption has not been isolated yet.";
  const strongestCounter = card.evidence_against?.[0] || "The squad has not yet found strong counter-evidence, but absence of evidence is not proof.";

  if (targetIndex < currentIndex) {
    return {
      status: "ALREADY EARNED",
      heading: "WHY THIS LEVEL IS ALREADY BEHIND THE IDEA",
      why: `Foundry currently places this idea beyond ${READINESS_STAGES[targetIndex]}. That means the present research packet already supports the minimum standard for this stage.`,
      questions: [
        "What evidence originally earned this level?",
        "Has any newer evidence weakened that conclusion?",
        "What would have to be false for the idea to fall back below this level?",
      ],
      proof: "This stage is already supported by the current card. The useful question now is whether the evidence still deserves to stand.",
    };
  }

  if (targetIndex === currentIndex) {
    return {
      status: "CURRENT STAGE",
      heading: "WHY THE IDEA IS HERE NOW",
      why: readinessMeaning(currentIndex),
      questions: [
        "What is the weakest assumption at this stage?",
        "What evidence would move this idea forward one level?",
        "What evidence would move it backward or make me stop?",
        "Am I reacting to real outside evidence or mainly to how much I like the idea?",
      ],
      proof: "The current evidence supports this level, but Foundry does not yet see enough proof for the next one.",
    };
  }

  if (targetIndex === 1) {
    return {
      status: "NOT EARNED YET",
      heading: "WHY THIS IS NOT YET A DESIGN EXERCISE WORTH PURSUING",
      why: `Foundry has not yet separated a recurring problem from an interesting concept strongly enough. Biggest open question: ${biggestUnknown}`,
      questions: [
        "What exact moment or frustration made me notice this?",
        "Who experiences that problem repeatedly, not just occasionally?",
        "What are they already doing instead?",
        "If nobody fixed this, what real cost, delay, risk, or frustration remains?",
      ],
      proof: "A specific recurring problem, a specific person who has it, the current workaround, and a clear reason the workaround is unsatisfying.",
    };
  }

  if (targetIndex === 2) {
    return {
      status: "NOT EARNED YET",
      heading: "WHY THIS HAS NOT EARNED VALIDATION YET",
      why: `The idea still needs stronger evidence outside the concept itself. Foundry is carrying ${card.unknowns.length} material unknown${card.unknowns.length === 1 ? "" : "s"}. Strongest current counterpoint: ${strongestCounter}`,
      questions: [
        "Which assumption would kill this idea immediately if it were false?",
        "What evidence would convince Jerry that the pain exists without me explaining the idea first?",
        "Are people already spending time, money, or effort to work around this problem?",
        "What would count as real behavior rather than polite interest or compliments?",
      ],
      proof: "Independent evidence that the pain is recurring, the current alternatives leave a meaningful gap, and the target customer cares enough to change behavior.",
    };
  }

  if (targetIndex === 3) {
    return {
      status: "NOT EARNED YET",
      heading: "WHY THIS IS NOT YET TESTABLE",
      why: `The research has not yet justified spending even bounded test time at this level. Current AI recommendation: ${card.recommendation}. Biggest open question: ${biggestUnknown}`,
      questions: [
        "Can I define what success and failure mean before I test anything?",
        "Can the biggest uncertainty be answered without quietly building the product?",
        "What would a target buyer have to do, not merely say, to justify another hour?",
        "Is the test small enough that CASEVOICE and current priorities remain untouched?",
      ],
      proof: "A cheap, bounded experiment with a clear question, observable pass and kill results, realistic founder time, and no hidden product build.",
    };
  }

  return {
    status: "NOT EARNED YET",
    heading: "WHY THIS IS NOT YET A PROMOTION CANDIDATE",
    why: `Promotion means this idea competes for real Vogtcom execution. The card has not earned that status yet. Current lifecycle: ${card.lifecycle}. Current score: ${card.score}/100.`,
    questions: [
      "What has been proven by actual behavior, payment, usage, or repeated demand?",
      "Why should this take founder time away from CASEVOICE now?",
      "Does the evidence show a repeatable opportunity or only one interesting experiment?",
      "Can one founder deliver and support this without creating another permanent burden?",
      "What result would make promotion obviously wrong even if I still like the idea?",
    ],
    proof: `The approved test meets its success trigger, buyer behavior or payment intent is credible, workload and risk remain acceptable, and Daniel explicitly decides that the opportunity deserves promotion. Current success trigger: ${card.success_trigger}`,
  };
}

function chooseRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function isActiveCard(card: FoundryCard) {
  return card.lifecycle !== "HOLD" && card.lifecycle !== "KILL";
}

function matchesFilter(card: FoundryCard, filter: VaultFilter) {
  if (filter === "ALL") return true;
  if (filter === "HOLD") return card.lifecycle === "HOLD";
  if (filter === "KILL") return card.lifecycle === "KILL";
  return isActiveCard(card);
}

export default function FoundryView() {
  const [rawInput, setRawInput] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [cards, setCards] = useState<FoundryCard[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [vaultFilter, setVaultFilter] = useState<VaultFilter>("ACTIVE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [readinessFocus, setReadinessFocus] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [pendingSegments, setPendingSegments] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentTimerRef = useRef<number | null>(null);
  const listeningRef = useRef(false);
  const transcriptQueueRef = useRef<Promise<void>>(Promise.resolve());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelFrameRef = useRef<number | null>(null);
  const transcribing = pendingSegments > 0;

  const decisionCards = useMemo(() => cards.filter((card) => card.lifecycle === "TESTABLE"), [cards]);
  const visibleCards = useMemo(() => cards.filter((card) => matchesFilter(card, vaultFilter)), [cards, vaultFilter]);
  const selected = useMemo(() => {
    if (selectedId) return cards.find((card) => card.id === selectedId) ?? null;
    return decisionCards[0] ?? null;
  }, [cards, decisionCards, selectedId]);
  const selectedOverview = useMemo(() => {
    if (!selected) return null;
    const founderVerdict = selected.decision
      ? `YOU: ${selected.decision} · STATE: ${selected.lifecycle}`
      : `AI: ${selected.recommendation} · ${selected.score}/100`;
    const continueReason = selected.evidence_for?.[0] || "No strong positive evidence has been established yet.";
    const stopReason = selected.evidence_against?.[0] || "No strong counter-evidence has been established yet.";
    const biggestUnknown = selected.unknowns?.[0] || "No material unknown was recorded.";
    const nextMove = selected.lifecycle === "KILL"
      ? `Stop unless this changes: ${selected.kill_trigger}`
      : selected.smallest_test;
    const control = selected.lifecycle === "TESTING"
      ? "Keep this as a bounded test. Do not promote it into a Project or Canon until the success trigger is met and Daniel approves promotion."
      : selected.lifecycle === "KILL"
        ? "Keep it archived unless new evidence directly changes the kill trigger."
        : "Keep it outside Projects and Canon until Daniel approves a test or later promotion.";
    return {
      signal: selected.observation || selected.raw_input || selected.title,
      verdict: founderVerdict,
      continueReason,
      stopReason,
      assessment: selected.recommendation_reason,
      biggestUnknown,
      nextMove,
      define: selected.problem,
      measure: `PASS: ${selected.success_trigger} · STOP: ${selected.kill_trigger}`,
      analyze: `FOR: ${continueReason} · AGAINST: ${stopReason} · UNKNOWN: ${biggestUnknown}`,
      improve: nextMove,
      control,
      sources: selected.sources.slice(0, 4),
    };
  }, [selected]);
  const selectedReadiness = useMemo(() => {
    if (!selected) return null;
    const index = readinessIndex(selected);
    return {
      index,
      label: READINESS_STAGES[index],
      meaning: readinessMeaning(index),
    };
  }, [selected]);
  const selectedReadinessCoach = useMemo(() => {
    if (!selected || !selectedReadiness || readinessFocus === null) return null;
    return {
      stage: READINESS_STAGES[readinessFocus],
      ...readinessCoach(selected, readinessFocus, selectedReadiness.index),
    };
  }, [selected, selectedReadiness, readinessFocus]);
  const decisionCount = decisionCards.length;
  const activeCount = cards.filter(isActiveCard).length;
  const holdCount = cards.filter((card) => card.lifecycle === "HOLD").length;
  const killCount = cards.filter((card) => card.lifecycle === "KILL").length;
  const levelLabel = micLevel < 0.12 ? "TOO QUIET" : micLevel > 0.85 ? "TOO LOUD" : "GOOD LEVEL";
  const levelColor = micLevel < 0.12 ? "#FBBF24" : micLevel > 0.85 ? "#F87171" : "#4ADE80";
  const voiceStatus = recording
    ? pendingSegments > 2
      ? "LISTENING · CATCHING UP"
      : pendingSegments > 0
        ? "LISTENING · BUFFERING"
        : "LISTENING"
    : pendingSegments > 0
      ? "FINISHING TRANSCRIPTION"
      : "READY";

  async function refresh(preferId?: string) {
    const next = await listFoundryCards();
    setCards(next);
    if (preferId && next.some((card) => card.id === preferId)) {
      setSelectedId(preferId);
      return;
    }
    setSelectedId(next.find((card) => card.lifecycle === "TESTABLE")?.id ?? "");
  }

  function changeVaultFilter(filter: VaultFilter) {
    setVaultFilter(filter);
    setShowAnalysis(false);
    setReadinessFocus(null);
    const matching = cards.filter((card) => matchesFilter(card, filter));
    const next = filter === "ACTIVE"
      ? matching.find((card) => card.lifecycle === "TESTABLE") ?? matching[0]
      : matching[0];
    setSelectedId(next?.id ?? "");
  }

  function clearSegmentTimer() {
    if (segmentTimerRef.current !== null) {
      window.clearTimeout(segmentTimerRef.current);
      segmentTimerRef.current = null;
    }
  }

  function stopLevelMonitor() {
    if (levelFrameRef.current !== null) {
      window.cancelAnimationFrame(levelFrameRef.current);
      levelFrameRef.current = null;
    }
    analyserRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    setMicLevel(0);
    if (context && context.state !== "closed") {
      context.close().catch(() => undefined);
    }
  }

  function startLevelMonitor(stream: MediaStream) {
    stopLevelMonitor();
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = new AudioContextCtor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.65;
    source.connect(analyser);
    audioContextRef.current = context;
    analyserRef.current = analyser;
    const samples = new Uint8Array(analyser.fftSize);

    const updateLevel = () => {
      if (!listeningRef.current || !analyserRef.current) return;
      analyser.getByteTimeDomainData(samples);
      let squareSum = 0;
      for (const sample of samples) {
        const centered = (sample - 128) / 128;
        squareSum += centered * centered;
      }
      const rms = Math.sqrt(squareSum / samples.length);
      setMicLevel(Math.min(1, rms * 4));
      levelFrameRef.current = window.requestAnimationFrame(updateLevel);
    };

    levelFrameRef.current = window.requestAnimationFrame(updateLevel);
  }

  function releaseVoiceHardware() {
    clearSegmentTimer();
    stopLevelMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    listeningRef.current = false;
    setRecording(false);
  }

  function appendTranscript(text: string) {
    const cleaned = text.trim();
    if (!cleaned) return;
    setRawInput((current) => `${current}${current.trim() ? " " : ""}${cleaned}`);
  }

  function queueTranscript(audio: Blob) {
    if (!audio.size) return;
    setPendingSegments((count) => count + 1);
    transcriptQueueRef.current = transcriptQueueRef.current
      .then(async () => {
        const text = await transcribeFoundryAudio(audio);
        appendTranscript(text);
        setError("");
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : "Voice transcription failed.";
        if (!message.toLowerCase().includes("no speech")) setError(message);
      })
      .finally(() => {
        setPendingSegments((count) => Math.max(0, count - 1));
      });
  }

  function startVoiceSegment() {
    const stream = streamRef.current;
    if (!listeningRef.current || !stream) return;

    const mimeType = chooseRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onerror = () => {
      listeningRef.current = false;
      releaseVoiceHardware();
      setError("Voice recording stopped unexpectedly. Your existing text is safe.");
    };

    recorder.onstop = () => {
      clearSegmentTimer();
      const finalType = recorder.mimeType || chunks[0]?.type || "audio/webm";
      if (chunks.length > 0) queueTranscript(new Blob(chunks, { type: finalType }));
      recorderRef.current = null;

      if (listeningRef.current && streamRef.current) {
        window.setTimeout(startVoiceSegment, 0);
      } else {
        releaseVoiceHardware();
      }
    };

    recorder.start();
    segmentTimerRef.current = window.setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, LIVE_CHUNK_MS);
  }

  function stopVoice() {
    listeningRef.current = false;
    clearSegmentTimer();
    setRecording(false);
    stopLevelMonitor();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else releaseVoiceHardware();
  }

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load Foundry."));
    return () => {
      listeningRef.current = false;
      clearSegmentTimer();
      stopLevelMonitor();
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    setReadinessFocus(null);
  }, [selectedId]);

  async function toggleVoice() {
    if (recording) {
      stopVoice();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record voice notes. Type or paste the thought instead.");
      return;
    }

    setError("");
    setNotice("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      listeningRef.current = true;
      setRecording(true);
      startLevelMonitor(stream);
      startVoiceSegment();
    } catch (e) {
      releaseVoiceHardware();
      const message = e instanceof DOMException && e.name === "NotAllowedError"
        ? "Microphone permission was blocked. Allow microphone access for this site and try again."
        : "Could not start the microphone. Try again or type the thought.";
      setError(message);
    }
  }

  async function submitIdea() {
    if (!rawInput.trim()) {
      setError("Dump the thought first. No form required.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    setShowAnalysis(false);
    setReadinessFocus(null);
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
      setVaultFilter("ACTIVE");
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
    setNotice("");
    try {
      const updated = await recordFoundryDecision(selected, decision);
      const nextCards = cards.map((card) => (card.id === updated.id ? updated : card));
      setCards(nextCards);
      setShowAnalysis(false);
      setReadinessFocus(null);

      const nextDecision = nextCards.find((card) => card.lifecycle === "TESTABLE" && card.id !== updated.id);
      setSelectedId(nextDecision?.id ?? "");
      setVaultFilter("ACTIVE");

      if (decision === "HOLD") setNotice(`Moved “${updated.title}” to HOLD. It remains in the Vault history.`);
      else if (decision === "KILL") setNotice(`Moved “${updated.title}” to KILL. It remains in the Vault history.`);
      else if (decision === "TEST") setNotice(`Test approved for “${updated.title}”. It moved out of the decision queue and remains ACTIVE as TESTING.`);
      else setNotice(`Decision recorded for “${updated.title}”.`);
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Brain dump</h2>
              <p className="mt-1 text-xs" style={{ color: MUTED }}>
                {recording
                  ? "LIVE DICTATION ON. Text appears every few seconds. Keep talking and edit the text whenever you want."
                  : transcribing
                    ? "Finishing the last voice chunk. You can keep editing the text."
                    : "One sentence is enough. Swearing, fragments, pasted notes, and half-formed ideas are allowed."}
              </p>
            </div>
            <button
              type="button"
              onClick={toggleVoice}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"
              style={{ borderColor: recording ? "#F87171" : BORDER, color: recording ? "#F87171" : TEXT }}
            >
              {recording ? <MicOff size={14} /> : <Mic size={14} />}
              {recording ? "STOP" : "VOICE"}
            </button>
          </div>

          {(recording || transcribing) && (
            <div className="mt-3 rounded-xl border p-3" style={{ borderColor: BORDER, backgroundColor: BG }} aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: recording ? "#4ADE80" : GOLD }} />
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: recording ? "#4ADE80" : GOLD }}>{voiceStatus}</span>
                </div>
                {pendingSegments > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>
                    {pendingSegments} chunk{pendingSegments === 1 ? "" : "s"} waiting
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <div className="min-w-48 flex-1">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span style={{ color: MUTED }}>MIC LEVEL</span>
                    <span style={{ color: recording ? levelColor : MUTED }}>{recording ? levelLabel : "MIC OFF"}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: BORDER }}>
                    <div
                      className="h-full rounded-full transition-[width] duration-100"
                      style={{ width: `${Math.round(micLevel * 100)}%`, backgroundColor: levelColor }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] uppercase" style={{ color: MUTED }}>
                    <span>Quiet</span><span>Good</span><span>Loud</span>
                  </div>
                </div>
                <div className="min-w-48 text-[11px] leading-relaxed" style={{ color: MUTED }}>
                  {pendingSegments > 2
                    ? "You are still being recorded. Text is behind and catching up."
                    : pendingSegments > 0
                      ? "You are still being recorded. Foundry is processing recent speech."
                      : "Your microphone is live. Keep speaking normally."}
                </div>
              </div>
            </div>
          )}

          <textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            className="mt-4 min-h-32 w-full rounded-xl border p-4 text-sm outline-none"
            style={{ borderColor: recording ? "#4ADE80" : BORDER, backgroundColor: BG, color: TEXT }}
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
              disabled={busy || transcribing || recording || !rawInput.trim()}
              onClick={submitIdea}
              className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold disabled:opacity-40"
              style={{ backgroundColor: GOLD, color: "#08111F" }}
            >
              <Search size={14} />
              {busy ? "RESEARCHING…" : "RESEARCH IDEA"}
            </button>
          </div>
          {notice && <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#4ADE80", color: "#86EFAC" }}>{notice}</div>}
          {error && <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "#F87171", color: "#FCA5A5" }}>{error}</div>}
        </section>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.6fr]">
          <section className="rounded-2xl border p-4" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>IDEA VAULT</div>
            <div className="mb-3 text-[10px]" style={{ color: MUTED }}>Decisions leave the active queue but stay here as history.</div>
            <div className="mb-3 grid grid-cols-4 gap-1">
              {([
                ["ACTIVE", activeCount],
                ["HOLD", holdCount],
                ["KILL", killCount],
                ["ALL", cards.length],
              ] as [VaultFilter, number][]).map(([filter, count]) => (
                <button
                  type="button"
                  key={filter}
                  onClick={() => changeVaultFilter(filter)}
                  className="rounded-lg border px-2 py-2 text-[9px] font-bold"
                  style={{
                    borderColor: vaultFilter === filter ? GOLD : BORDER,
                    color: vaultFilter === filter ? GOLD : MUTED,
                    backgroundColor: BG,
                  }}
                >
                  {filter} {count}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {visibleCards.length === 0 && (
                <div className="rounded-xl border p-4 text-sm" style={{ borderColor: BORDER, color: MUTED }}>
                  No {vaultFilter.toLowerCase()} Foundry cards.
                </div>
              )}
              {visibleCards.map((card) => (
                <button
                  type="button"
                  key={card.id}
                  onClick={() => { setSelectedId(card.id); setShowAnalysis(false); setReadinessFocus(null); }}
                  className="w-full rounded-xl border p-3 text-left"
                  style={{ borderColor: selected?.id === card.id ? GOLD : BORDER, backgroundColor: BG }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold" style={{ color: TEXT }}>{card.title}</div>
                    <div className="text-right">
                      <div className="text-[9px] font-bold uppercase" style={{ color: recommendationTone[card.recommendation] ?? MUTED }}>AI {card.recommendation}</div>
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: card.lifecycle === "HOLD" ? "#FBBF24" : card.lifecycle === "KILL" ? "#FCA5A5" : GOLD }}>{card.lifecycle}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px]" style={{ color: MUTED }}>{compact(card.problem, 95)}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border p-5" style={{ borderColor: BORDER, backgroundColor: CARD }}>
            {!selected ? (
              <div className="py-12 text-center text-sm" style={{ color: MUTED }}>
                {decisionCount > 0 ? "Select a Foundry decision from the Vault." : "No Foundry decisions need your attention."}
              </div>
            ) : (
              <>
                {selectedReadiness && (
                  <div className="mb-4 rounded-xl border p-4" style={{ borderColor: BORDER, backgroundColor: BG }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>PROJECT READINESS</div>
                      <div className="text-xs font-bold" style={{ color: GOLD }}>CURRENT READ: {selectedReadiness.label}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
                      {READINESS_STAGES.map((stage, index) => {
                        const isCurrent = index === selectedReadiness.index;
                        const isPassed = index < selectedReadiness.index;
                        const isFocused = readinessFocus === index;
                        return (
                          <button
                            type="button"
                            key={stage}
                            onClick={() => setReadinessFocus((current) => current === index ? null : index)}
                            aria-pressed={isFocused}
                            className="rounded-lg border px-2 py-3 text-center text-[9px] font-bold uppercase tracking-wider transition-colors"
                            style={{
                              borderColor: isCurrent ? GOLD : isPassed ? "#4ADE80" : BORDER,
                              backgroundColor: isCurrent ? GOLD : isPassed ? "rgba(74,222,128,0.08)" : CARD,
                              color: isCurrent ? BG : isPassed ? "#86EFAC" : MUTED,
                              boxShadow: isFocused ? "0 0 0 1px #60A5FA" : "none",
                            }}
                            title={`Click to understand ${stage}`}
                          >
                            {stage}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 text-xs leading-relaxed" style={{ color: TEXT }}>{selectedReadiness.meaning}</div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>
                      <span>AI SCORE {selected.score}/100</span>
                      <span>SOURCES {selected.sources.length}</span>
                      <span>UNKNOWNS {selected.unknowns.length}</span>
                      <span>RISKS {selected.primary_risks.length}</span>
                      <span>TEST {selected.estimated_cash} · {selected.estimated_founder_time}</span>
                    </div>

                    {selectedReadinessCoach && (
                      <div className="mt-4 rounded-xl border p-4" style={{ borderColor: "#2B4A73", backgroundColor: CARD }}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "#60A5FA" }}>STAGE COACH · {selectedReadinessCoach.stage}</div>
                            <div className="mt-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: selectedReadinessCoach.status === "NOT EARNED YET" ? "#FBBF24" : selectedReadinessCoach.status === "CURRENT STAGE" ? GOLD : "#86EFAC" }}>{selectedReadinessCoach.status}</div>
                          </div>
                          <button type="button" onClick={() => setReadinessFocus(null)} className="text-[10px] uppercase" style={{ color: MUTED }}>CLOSE</button>
                        </div>

                        <div className="mt-3">
                          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>{selectedReadinessCoach.heading}</div>
                          <div className="mt-1 text-xs leading-relaxed" style={{ color: TEXT }}>{selectedReadinessCoach.why}</div>
                        </div>

                        <div className="mt-4">
                          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>QUESTIONS TO THINK ABOUT</div>
                          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed" style={{ color: TEXT }}>
                            {selectedReadinessCoach.questions.map((question) => <li key={question}>{question}</li>)}
                          </ul>
                        </div>

                        <div className="mt-4 rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
                          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#86EFAC" }}>WHAT WOULD CHANGE THE READ</div>
                          <div className="mt-1 text-xs leading-relaxed" style={{ color: TEXT }}>{selectedReadinessCoach.proof}</div>
                        </div>

                        <div className="mt-3 text-[10px] leading-relaxed" style={{ color: MUTED }}>
                          These are questions, not instructions. Foundry identifies the missing proof. Daniel decides how, or whether, to pursue it.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedOverview && (
                  <div className="mb-5 rounded-xl border p-4" style={{ borderColor: GOLD, backgroundColor: "rgba(201,168,76,0.06)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>FOUNDRY OVERVIEW</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>Structured decision note + L6S quick audit</div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>S / SIGNAL</div>
                        <div className="mt-2 text-sm leading-relaxed" style={{ color: TEXT }}>{compact(selectedOverview.signal, 420)}</div>
                      </div>

                      <div className="rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>O / OBJECTIVE EVIDENCE</div>
                        <div className="mt-2 text-xs leading-relaxed" style={{ color: "#86EFAC" }}><span className="font-bold">FOR:</span> {compact(selectedOverview.continueReason, 260)}</div>
                        <div className="mt-2 text-xs leading-relaxed" style={{ color: "#FCA5A5" }}><span className="font-bold">AGAINST:</span> {compact(selectedOverview.stopReason, 260)}</div>
                      </div>

                      <div className="rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>A / ASSESSMENT</div>
                        <div className="mt-2 text-sm font-bold" style={{ color: selected.decision ? GOLD : recommendationTone[selected.recommendation] }}>{selectedOverview.verdict}</div>
                        <div className="mt-2 text-xs leading-relaxed" style={{ color: TEXT }}>{compact(selectedOverview.assessment, 320)}</div>
                        <div className="mt-2 text-[11px] leading-relaxed" style={{ color: MUTED }}><span className="font-bold">BIGGEST UNKNOWN:</span> {compact(selectedOverview.biggestUnknown, 220)}</div>
                      </div>

                      <div className="rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>P / PLAN</div>
                        <div className="mt-2 text-sm leading-relaxed" style={{ color: TEXT }}>{compact(selectedOverview.nextMove, 360)}</div>
                        <div className="mt-3 text-[11px]" style={{ color: MUTED }}>Cash: {selected.estimated_cash} · Founder time: {selected.estimated_founder_time}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "rgba(201,168,76,0.45)", backgroundColor: BG }}>
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>L6S / DMAIC OVERVIEW</div>
                      <div className="mt-3 space-y-2">
                        {([
                          ["DEFINE", selectedOverview.define],
                          ["MEASURE", selectedOverview.measure],
                          ["ANALYZE", selectedOverview.analyze],
                          ["IMPROVE", selectedOverview.improve],
                          ["CONTROL", selectedOverview.control],
                        ] as [string, string][]).map(([label, value]) => (
                          <div key={label} className="grid gap-1 md:grid-cols-[80px_1fr]">
                            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>{label}</div>
                            <div className="text-xs leading-relaxed" style={{ color: TEXT }}>{compact(value, label === "ANALYZE" ? 360 : 300)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border p-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>SOURCE CHECK</div>
                        <div className="text-[10px]" style={{ color: MUTED }}>{selectedOverview.sources.length} research source{selectedOverview.sources.length === 1 ? "" : "s"} shown</div>
                      </div>
                      {selected.source_url && (
                        <a href={selected.source_url} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline" style={{ color: "#60A5FA" }}>Founder-provided source</a>
                      )}
                      {selectedOverview.sources.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {selectedOverview.sources.map((source) => (
                            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="block text-xs underline" style={{ color: "#60A5FA" }}>{source.title || source.url}</a>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs" style={{ color: MUTED }}>No external research sources were returned on this card.</div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>{selected.lifecycle === "TESTABLE" ? "FOUNDRY DECISION" : "FOUNDRY RECORD"}</div>
                    <h2 className="mt-2 text-xl font-bold">{selected.title}</h2>
                    {selected.lifecycle !== "TESTABLE" && <div className="mt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>STATE: {selected.lifecycle}</div>}
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
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: MUTED }}>FOUNDRY REVIEW SQUAD</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {selected.workers.map((worker) => (
                          <div key={`${worker.role}-${worker.finding}`} className="rounded-lg border p-3 text-xs" style={{ borderColor: worker.role.toUpperCase().includes("JERRY") ? "#F87171" : BORDER }}>
                            <div className="font-bold" style={{ color: worker.role.toUpperCase().includes("JERRY") ? "#FCA5A5" : GOLD }}>{worker.role}</div>
                            <div className="mt-1 leading-relaxed" style={{ color: TEXT }}>{worker.finding}</div>
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
