import { useMemo, useState } from "react";
import type { FormEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import {
  addPromptVersion,
  createPromptRecord,
  currentPromptVersion,
  exportPromptLibrary,
  latestPromptOutcome,
  listPromptRecords,
  recordPromptUse,
  updatePromptRecordMetadata,
} from "../lib/promptIntelligence";
import type { PromptOutcome, PromptRecord, PromptStatus } from "../lib/promptIntelligence";

const STATUS: Record<PromptStatus, string> = { READY: "#22C55E", TESTING: "#F59E0B", "NEEDS WORK": "#EF4444", RETIRED: "#64748B", REFERENCE: "#60A5FA" };
const OUTCOME: Record<PromptOutcome, string> = { WORKED: "#22C55E", "PARTLY WORKED": "#F59E0B", FAILED: "#EF4444", "NOT TESTED": "#64748B" };
const fieldStyle = { backgroundColor: "#08111F", borderColor: "#1B2A4A", color: "#E2E8F0" };

function csv(value: string): string[] { return value.split(",").map((v) => v.trim()).filter(Boolean); }
function date(value: string): string { return value ? new Date(value).toLocaleDateString() : "Never"; }
function Badge({ text, color }: { text: string; color: string }) { return <span className="rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider" style={{ color, borderColor: `${color}66` }}>{text}</span>; }
function Card({ title, children }: { title: string; children: ReactNode }) { return <section className="rounded-xl border p-5" style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A" }}><div className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#C9A84C" }}>{title}</div>{children}</section>; }
function Label({ children }: { children: ReactNode }) { return <div className="mb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: "#64748B" }}>{children}</div>; }
function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ ...fieldStyle, ...props.style }} />; }
function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className="w-full rounded-lg border px-3 py-2 text-sm outline-none" style={{ ...fieldStyle, ...props.style }} />; }

export default function PromptIntelligenceView() {
  const [records, setRecords] = useState<PromptRecord[]>(() => listPromptRecords());
  const [selectedId, setSelectedId] = useState(() => records[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [mode, setMode] = useState<"" | "capture" | "use" | "version">("");
  const [message, setMessage] = useState("");
  const selected = records.find((r) => r.id === selectedId) ?? records[0];

  const projects = useMemo(() => ["ALL", ...Array.from(new Set(records.flatMap((r) => r.projects))).sort()], [records]);
  const filtered = useMemo(() => records.filter((r) => {
    const text = [r.title, r.plain_summary, r.why_kept, r.notes, ...r.tags, ...r.projects, ...r.task_types, ...r.versions.map((v) => v.prompt_text)].join(" ").toLowerCase();
    return (!query.trim() || text.includes(query.toLowerCase())) && (project === "ALL" || r.projects.includes(project)) && (status === "ALL" || r.status === status);
  }), [records, query, project, status]);

  function refresh(id?: string) { const next = listPromptRecords(); setRecords(next); if (id) setSelectedId(id); }
  function exportJson() {
    const url = URL.createObjectURL(new Blob([exportPromptLibrary()], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `vogtcom-prompt-intelligence-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
    setMessage("Prompt library exported as JSON.");
  }
  function setPromptStatus(next: PromptStatus) { if (!selected) return; updatePromptRecordMetadata(selected.id, { status: next }); refresh(selected.id); }

  return <div className="min-h-full w-full p-6" style={{ backgroundColor: "#08111F" }}>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: "#C9A84C" }}>Prompt Intelligence</div><h1 className="mt-1 text-2xl font-bold">Vogtcom Prompt Map</h1><p className="mt-2 max-w-3xl text-sm" style={{ color: "#8A9BB5" }}>What each prompt does, where we used it, what failed, what changed, and why the next version exists.</p></div>
      <div className="flex gap-2"><button onClick={() => setMode(mode === "capture" ? "" : "capture")} className="rounded-lg border px-4 py-2 text-xs font-bold" style={{ color: "#C9A84C", borderColor: "#C9A84C" }}>ADD PROMPT</button><button onClick={exportJson} className="rounded-lg border px-4 py-2 text-xs font-bold" style={{ ...fieldStyle }}>EXPORT JSON</button></div>
    </div>

    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">{[
      ["PROMPTS", records.length], ["READY", records.filter((r) => r.status === "READY").length], ["TESTED", records.filter((r) => r.uses.length).length], ["NEEDS WORK", records.filter((r) => r.status === "NEEDS WORK").length],
    ].map(([label, value]) => <div key={String(label)} className="rounded-xl border p-4" style={{ backgroundColor: "#0D1B2E", borderColor: "#1B2A4A" }}><div className="text-[9px] font-bold uppercase" style={{ color: "#64748B" }}>{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div>)}</div>
    {message && <div className="mb-4 rounded-lg border px-3 py-2 text-xs" style={{ ...fieldStyle, color: "#A7F3D0" }}>{message}</div>}
    {mode === "capture" && <Capture onSaved={(id) => { refresh(id); setMode(""); setMessage("Prompt captured."); }} />}

    <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_190px]"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prompts, projects, tags, or prompt text" /><select value={project} onChange={(e) => setProject(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>{projects.map((p) => <option key={p}>{p}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>{["ALL", "READY", "TESTING", "NEEDS WORK", "REFERENCE", "RETIRED"].map((s) => <option key={s}>{s}</option>)}</select></div>

    <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
      <div className="space-y-3">{filtered.map((r) => <button key={r.id} onClick={() => { setSelectedId(r.id); setMode(""); }} className="w-full rounded-xl border p-4 text-left" style={{ backgroundColor: r.id === selected?.id ? "#132845" : "#0D1B2E", borderColor: r.id === selected?.id ? "#C9A84C" : "#1B2A4A" }}><div className="flex justify-between gap-2"><div className="text-sm font-bold">{r.title}</div><Badge text={r.status} color={STATUS[r.status]} /></div><div className="mt-2 text-xs leading-relaxed" style={{ color: "#8A9BB5" }}>{r.plain_summary}</div><div className="mt-3 flex items-center gap-2"><Badge text={latestPromptOutcome(r)} color={OUTCOME[latestPromptOutcome(r)]} /><span className="text-[10px]" style={{ color: "#64748B" }}>{currentPromptVersion(r).version} · {r.uses.length ? `last used ${date(r.uses[0].used_at)}` : "not used yet"}</span></div></button>)}</div>
      <div>{selected ? <Detail record={selected} mode={mode} setMode={setMode} onRefresh={() => refresh(selected.id)} onStatus={setPromptStatus} /> : <Card title="No prompt selected"><div style={{ color: "#8A9BB5" }}>No prompt records match the current filters.</div></Card>}</div>
    </div>
  </div>;
}

function Detail({ record, mode, setMode, onRefresh, onStatus }: { record: PromptRecord; mode: "" | "capture" | "use" | "version"; setMode: (v: "" | "capture" | "use" | "version") => void; onRefresh: () => void; onStatus: (v: PromptStatus) => void }) {
  const version = currentPromptVersion(record); const outcome = latestPromptOutcome(record); const last = record.uses[0];
  return <div className="space-y-4">
    <Card title="At a glance"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{record.title}</h2><div className="mt-2 flex gap-2"><Badge text={record.status} color={STATUS[record.status]} /><Badge text={outcome} color={OUTCOME[outcome]} /></div></div><select value={record.status} onChange={(e) => onStatus(e.target.value as PromptStatus)} className="rounded-lg border px-3 py-2 text-xs" style={fieldStyle}>{(["READY", "TESTING", "NEEDS WORK", "REFERENCE", "RETIRED"] as PromptStatus[]).map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2"><div><Label>What this does</Label><div className="text-sm">{record.plain_summary}</div></div><div><Label>Why Vogtcom kept it</Label><div className="text-sm">{record.why_kept}</div></div><div><Label>Used for</Label><div className="text-sm">{record.projects.join(", ") || "Not assigned"}</div></div><div><Label>Task types</Label><div className="text-sm">{record.task_types.join(", ") || "Not assigned"}</div></div><div><Label>Current version</Label><div className="text-sm">{version.version} · {version.content_status}</div></div><div><Label>What we learned</Label><div className="text-sm">{last?.difference || last?.founder_correction || record.notes || "No real-use evidence yet."}</div></div></div>
      <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => setMode(mode === "use" ? "" : "use")} className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ color: "#C9A84C", borderColor: "#C9A84C" }}>LOG USE</button><button onClick={() => setMode(mode === "version" ? "" : "version")} className="rounded-lg border px-3 py-2 text-xs font-bold" style={fieldStyle}>NEW VERSION</button>{record.source_url && <a href={record.source_url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-xs font-bold" style={fieldStyle}>OPEN SOURCE</a>}</div>
    </Card>
    {mode === "use" && <Use record={record} onSaved={() => { onRefresh(); setMode(""); }} />}
    {mode === "version" && <Version record={record} onSaved={() => { onRefresh(); setMode(""); }} />}
    <Card title="Current prompt"><div className="mb-2 text-[10px]" style={{ color: "#64748B" }}>Exact stored text for {version.version}. Old versions are never overwritten.</div>{version.prompt_text ? <pre className="whitespace-pre-wrap rounded-lg border p-4 text-xs leading-relaxed" style={fieldStyle}>{version.prompt_text}</pre> : <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "#F59E0B55", color: "#FBBF24" }}>Full prompt text has not been archived yet. Refresh it from the original source before first use.</div>}</Card>
    <Card title="Version lineage"><div className="space-y-3">{record.versions.map((v) => <div key={v.id} className="rounded-lg border p-3" style={{ borderColor: "#1B2A4A" }}><div className="flex justify-between"><strong className="text-sm">{v.version}</strong><span className="text-[10px]" style={{ color: "#64748B" }}>{date(v.created_at)} · {v.tested ? "TESTED" : "NOT TESTED"}</span></div><div className="mt-2 text-xs" style={{ color: "#8A9BB5" }}>{v.change_summary}</div>{v.change_reason && <div className="mt-1 text-xs">Why: {v.change_reason}</div>}{v.evidence && <div className="mt-1 text-xs">Evidence: {v.evidence}</div>}</div>)}</div></Card>
    <Card title="Use, test, and failure history">{record.uses.length ? <div className="space-y-4">{record.uses.map((u) => <div key={u.id} className="rounded-lg border p-4" style={{ borderColor: "#1B2A4A" }}><div className="flex flex-wrap justify-between gap-2"><div className="text-sm font-bold">{u.project}: {u.task}</div><Badge text={u.outcome} color={OUTCOME[u.outcome]} /></div><div className="mt-2 text-[10px]" style={{ color: "#64748B" }}>{date(u.used_at)} · {u.ai_system || "AI/system not recorded"}</div><div className="mt-3 grid gap-3 md:grid-cols-2"><Mini label="Expected" value={u.expected_behavior} /><Mini label="Actual" value={u.actual_behavior} /><Mini label="Difference / failure" value={u.difference} /><Mini label="Daniel correction" value={u.founder_correction} /><Mini label="Verification" value={u.verification} /><Mini label="Source of truth" value={u.source_of_truth} /></div>{u.outcome !== "WORKED" && <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "#EF444455" }}><Mini label="Likely cause" value={u.failure_review.likely_cause} /><Mini label="Missing instruction" value={u.failure_review.missing_instruction} /><Mini label="Ignored instruction" value={u.failure_review.ignored_instruction} /><Mini label="Preserve next time" value={u.failure_review.preserve_next_time} /><Mini label="Proposed next prompt change" value={u.failure_review.proposed_change} /><Mini label="AI report" value={u.failure_review.ai_report} /></div>}</div>)}</div> : <div className="text-sm" style={{ color: "#8A9BB5" }}>No real-use evidence yet.</div>}</Card>
  </div>;
}
function Mini({ label, value }: { label: string; value: string }) { return value ? <div className="mb-2"><Label>{label}</Label><div className="text-xs leading-relaxed">{value}</div></div> : null; }

function Capture({ onSaved }: { onSaved: (id: string) => void }) {
  const [title, setTitle] = useState(""); const [url, setUrl] = useState(""); const [summary, setSummary] = useState(""); const [why, setWhy] = useState(""); const [projects, setProjects] = useState(""); const [tasks, setTasks] = useState(""); const [tags, setTags] = useState(""); const [text, setText] = useState("");
  function submit(e: FormEvent) { e.preventDefault(); if (!title.trim() || !summary.trim()) return; const record = createPromptRecord({ title, source_url: url, plain_summary: summary, why_kept: why || "Captured for Vogtcom evaluation.", projects: csv(projects), task_types: csv(tasks), tags: csv(tags), prompt_text: text }); onSaved(record.id); }
  return <form onSubmit={submit} className="mb-5"><Card title="Capture prompt"><div className="grid gap-3 md:grid-cols-2"><div><Label>Name</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div><div><Label>Source URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} /></div><div className="md:col-span-2"><Label>Plain-English summary</Label><Input value={summary} onChange={(e) => setSummary(e.target.value)} required /></div><div className="md:col-span-2"><Label>Why Vogtcom kept it</Label><Input value={why} onChange={(e) => setWhy(e.target.value)} /></div><div><Label>Projects, comma separated</Label><Input value={projects} onChange={(e) => setProjects(e.target.value)} /></div><div><Label>Task types, comma separated</Label><Input value={tasks} onChange={(e) => setTasks(e.target.value)} /></div><div className="md:col-span-2"><Label>Tags</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} /></div><div className="md:col-span-2"><Label>Exact original prompt text</Label><Area rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Leave blank only if the full source text has not been captured yet." /></div></div><button className="mt-4 rounded-lg border px-4 py-2 text-xs font-bold" style={{ color: "#C9A84C", borderColor: "#C9A84C" }}>SAVE PROMPT</button></Card></form>;
}

function Use({ record, onSaved }: { record: PromptRecord; onSaved: () => void }) {
  const current = currentPromptVersion(record); const [project, setProject] = useState(record.projects[0] ?? ""); const [task, setTask] = useState(""); const [system, setSystem] = useState("ChatGPT"); const [truth, setTruth] = useState(""); const [outcome, setOutcome] = useState<PromptOutcome>("WORKED"); const [expected, setExpected] = useState(""); const [actual, setActual] = useState(""); const [difference, setDifference] = useState(""); const [correction, setCorrection] = useState(""); const [verification, setVerification] = useState(""); const [cause, setCause] = useState(""); const [missing, setMissing] = useState(""); const [ignored, setIgnored] = useState(""); const [preserve, setPreserve] = useState(""); const [change, setChange] = useState(""); const [report, setReport] = useState("");
  function submit(e: FormEvent) { e.preventDefault(); recordPromptUse(record.id, { prompt_version_id: current.id, project, task, ai_system: system, source_of_truth: truth, outcome, expected_behavior: expected, actual_behavior: actual, difference, founder_correction: correction, verification, failure_review: { likely_cause: cause, missing_instruction: missing, ignored_instruction: ignored, preserve_next_time: preserve, proposed_change: change, ai_report: report } }); onSaved(); }
  const failed = outcome !== "WORKED";
  return <form onSubmit={submit}><Card title={`Log use of ${current.version}`}><div className="grid gap-3 md:grid-cols-2"><div><Label>Project</Label><Input value={project} onChange={(e) => setProject(e.target.value)} /></div><div><Label>AI / system</Label><Input value={system} onChange={(e) => setSystem(e.target.value)} /></div><div className="md:col-span-2"><Label>Exact task</Label><Input required value={task} onChange={(e) => setTask(e.target.value)} /></div><div className="md:col-span-2"><Label>Source of truth</Label><Input value={truth} onChange={(e) => setTruth(e.target.value)} /></div><div><Label>Result</Label><select value={outcome} onChange={(e) => setOutcome(e.target.value as PromptOutcome)} className="w-full rounded-lg border px-3 py-2 text-sm" style={fieldStyle}>{(["WORKED", "PARTLY WORKED", "FAILED"] as PromptOutcome[]).map((v) => <option key={v}>{v}</option>)}</select></div><div /><div><Label>Expected</Label><Area rows={4} value={expected} onChange={(e) => setExpected(e.target.value)} /></div><div><Label>Actual</Label><Area rows={4} value={actual} onChange={(e) => setActual(e.target.value)} /></div><div><Label>Difference / failure</Label><Area rows={4} value={difference} onChange={(e) => setDifference(e.target.value)} /></div><div><Label>Daniel correction</Label><Area rows={4} value={correction} onChange={(e) => setCorrection(e.target.value)} /></div><div className="md:col-span-2"><Label>Verification evidence</Label><Area rows={3} value={verification} onChange={(e) => setVerification(e.target.value)} /></div>{failed && <><div><Label>Likely cause</Label><Area rows={3} value={cause} onChange={(e) => setCause(e.target.value)} /></div><div><Label>Missing instruction</Label><Area rows={3} value={missing} onChange={(e) => setMissing(e.target.value)} /></div><div><Label>Ignored instruction</Label><Area rows={3} value={ignored} onChange={(e) => setIgnored(e.target.value)} /></div><div><Label>Preserve next time</Label><Area rows={3} value={preserve} onChange={(e) => setPreserve(e.target.value)} /></div><div className="md:col-span-2"><Label>Proposed next prompt change</Label><Area rows={3} value={change} onChange={(e) => setChange(e.target.value)} /></div><div className="md:col-span-2"><Label>AI failure analysis report</Label><Area rows={5} value={report} onChange={(e) => setReport(e.target.value)} /></div></>}</div><button className="mt-4 rounded-lg border px-4 py-2 text-xs font-bold" style={{ color: "#C9A84C", borderColor: "#C9A84C" }}>SAVE USE / TEST</button></Card></form>;
}

function Version({ record, onSaved }: { record: PromptRecord; onSaved: () => void }) {
  const current = currentPromptVersion(record); const [version, setVersion] = useState(""); const [text, setText] = useState(current.prompt_text); const [summary, setSummary] = useState(""); const [reason, setReason] = useState(""); const [evidence, setEvidence] = useState("");
  function submit(e: FormEvent) { e.preventDefault(); addPromptVersion(record.id, { version, prompt_text: text, change_summary: summary, change_reason: reason, evidence, tested: false }); onSaved(); }
  return <form onSubmit={submit}><Card title="Create next version"><div className="rounded-lg border p-3 text-xs" style={{ borderColor: "#F59E0B55", color: "#FBBF24" }}>This creates a new immutable version. It does not overwrite {current.version}.</div><div className="mt-3 grid gap-3"><div><Label>New version label</Label><Input required value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Example: V1.2" /></div><div><Label>Exact new prompt text</Label><Area required rows={12} value={text} onChange={(e) => setText(e.target.value)} /></div><div><Label>What changed</Label><Area required rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} /></div><div><Label>Why it changed</Label><Area required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div><div><Label>Evidence that caused the change</Label><Area rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} /></div></div><button className="mt-4 rounded-lg border px-4 py-2 text-xs font-bold" style={{ color: "#C9A84C", borderColor: "#C9A84C" }}>SAVE NEW VERSION</button></Card></form>;
}
