import { useEffect, useMemo, useState } from "react";

type MainTab = "TODAY" | "PROJECTS" | "EVIDENCE" | "MENTOR ROOM" | "SYSTEM";
type ProjectStatus = "NOW" | "BLOCKED" | "LATER" | "DONE";

type TodayTask = {
  id: string;
  text: string;
  done: boolean;
};

type ProjectCard = {
  name: string;
  status: ProjectStatus;
  job: string;
  gate: string;
  next: string;
  external: string;
  control: string;
  controlUrl: string;
  verified: string;
};

type Mentor = {
  name: string;
  lane: string;
};

const STORAGE_PREFIX = "vogtcom_founder_os_v1";
const MAIN_TABS: MainTab[] = ["TODAY", "PROJECTS", "EVIDENCE", "MENTOR ROOM", "SYSTEM"];

const COLORS = {
  bg: "#07111F",
  panel: "#0D1B2E",
  panel2: "#10233D",
  border: "#233A58",
  gold: "#D2B35A",
  text: "#F4F7FB",
  muted: "#A7B4C6",
  dim: "#6F8198",
  green: "#4FD1A5",
  yellow: "#F2C94C",
  red: "#FF7B7B",
  blue: "#78A9FF",
};

const PROJECTS: ProjectCard[] = [
  {
    name: "CASEVOICE / MyStatement",
    status: "BLOCKED",
    job: "Near-term revenue engine. MyStatement is the current user-side product; CASEVOICE is the organization-facing validation layer.",
    gate: "Internal 100/100 work is complete as far as Vogtcom can close it internally. External outreach remains closed pending qualified legal classification/review.",
    next: "Keep founder speaking and future outreach materials ready. Do not restart 100/100 or add product work to solve a legal blocker.",
    external: "Legal review / counsel classification and funding for that review.",
    control: "CASEVOICE 100/100 - START HERE",
    controlUrl: "https://docs.google.com/document/d/1rKWTCKUH_UlW84McBoYI-ppv8tXzsWkr-lYXZvrgI9o/edit",
    verified: "August 25, 2026",
  },
  {
    name: "MyTravBot",
    status: "NOW",
    job: "Product and traveler-validation engine. The product must become a useful handheld travel sherpa, not a dense desktop page.",
    gate: "Exact approved Crisp asset must load correctly before more styling. Then prove the five-action handheld flow one screen at a time.",
    next: "Crisp asset pipeline → home hit areas → SAY IT → NEARBY → REMEMBER → JOURNEY → T.I.M. → phone smoke test.",
    external: "Real traveler feedback after the core handheld flow is usable.",
    control: "MyTravBot Handheld Redesign EOD - August 23 2026",
    controlUrl: "https://docs.google.com/document/d/1H7oFhsbmp1ZbaWDK7yzqMHKANYdNdd39WP3I-dwKvz4/edit",
    verified: "August 25, 2026",
  },
  {
    name: "my420journal",
    status: "BLOCKED",
    job: "Long-term retention and strategic cannabis-data engine. Phase 1 is LOG + TALK + PLAY.",
    gate: "External legal gate remains HOLD. PLAY also still needs Daniel's founder acceptance of the corrected Weed Goblins vertical slice.",
    next: "Play the corrected Weed Goblins slice normally and record APPROVE / CHANGE / REWORK before any Game 2 replacement build.",
    external: "Cannabis-specific counsel before outside testing.",
    control: "Weed Goblins Founder Vertical Slice EOD - August 18 2026",
    controlUrl: "https://docs.google.com/document/d/1grpNzcgJvbBvvXiAzePcFQ3aGwrAk7NTXtH1SzCQiWM/edit",
    verified: "August 25, 2026",
  },
  {
    name: "Wild Acres Honey",
    status: "NOW",
    job: "Small local cash-generating operation whose job is to help fund Vogtcom legal work. It is not a fourth software startup.",
    gate: "Confirm Pennsylvania classification and requirements before spending money on room changes, rebottling equipment, or bulk seed packets.",
    next: "Use the Pennsylvania regulatory packet, send/prepare the state questions, and gather the paperwork the state will need.",
    external: "PDA answers, later inspection, honey sourcing, events/markets and physical sales.",
    control: "Wild Acres Honey - Pennsylvania Regulatory and Paperwork Packet - August 25 2026",
    controlUrl: "https://docs.google.com/document/d/1xfpNQMYsXQ7sqmmLau2OkDq7YJ35olGmvnIFPWXpbus/edit",
    verified: "August 25, 2026",
  },
];

const EVIDENCE_LINKS = [
  {
    title: "Vogtcom North Star - August 24 2026",
    note: "Company strategy and 30-day revenue-compression control.",
    url: "https://docs.google.com/document/d/151x8ErMfanC4cPs3pdDyo6kNgrq_HlXtrsJdcJP8654/edit",
  },
  {
    title: "Vogtcom 3-App Master Status Board",
    note: "Current cross-project status and gates.",
    url: "https://docs.google.com/document/d/19c6oufFU4kgrRI6nt9ywxsU5NElOe84pGG0G18YnJE4/edit",
  },
  {
    title: "CASEVOICE 100/100 - START HERE",
    note: "Controlling CASEVOICE index. Do not replace with older plans.",
    url: "https://docs.google.com/document/d/1rKWTCKUH_UlW84McBoYI-ppv8tXzsWkr-lYXZvrgI9o/edit",
  },
  {
    title: "CASEVOICE Founder Speaking Practice Pack",
    note: "Current practice scripts and no-bluff answers.",
    url: "https://docs.google.com/document/d/1WeBTZ5lHdGZufwVLIwuVY9h9C-h7ye5YxMxfevzzB7o/edit",
  },
  {
    title: "MyTravBot Handheld Redesign EOD",
    note: "Current Crisp/handheld implementation control.",
    url: "https://docs.google.com/document/d/1H7oFhsbmp1ZbaWDK7yzqMHKANYdNdd39WP3I-dwKvz4/edit",
  },
  {
    title: "my420journal Weed Goblins Founder Vertical Slice EOD",
    note: "Current PLAY founder-acceptance checkpoint.",
    url: "https://docs.google.com/document/d/1grpNzcgJvbBvvXiAzePcFQ3aGwrAk7NTXtH1SzCQiWM/edit",
  },
  {
    title: "Wild Acres Pennsylvania Regulatory Packet",
    note: "Current state questions, email drafts and paperwork list.",
    url: "https://docs.google.com/document/d/1xfpNQMYsXQ7sqmmLau2OkDq7YJ35olGmvnIFPWXpbus/edit",
  },
  {
    title: "Gemini Notebook Source Map + YouTube Content System",
    note: "What to load for study and what not to mix together.",
    url: "https://docs.google.com/document/d/1PyXrZVt1P3miunEmuNKG7NnkMEGg7vAPlPX7PF0SSlM/edit",
  },
  {
    title: "Founder OS North Star Revamp Spec",
    note: "Control for this dashboard cleanup/rebuild.",
    url: "https://docs.google.com/document/d/1gu0Il31ieHYfGRd6bOJmMxXghZpdVLrEWCmNVbKVo4A/edit",
  },
];

const MENTORS: Mentor[] = [
  { name: "Dan Martell", lane: "Founder systems, priorities, bottlenecks, delegation and scaling." },
  { name: "Justin Welsh", lane: "Customer discovery, simple offers, first customers and simple business models." },
  { name: "Rory Sutherland", lane: "Positioning, buyer psychology, framing and persuasion." },
  { name: "Esther Perel", lane: "Professional relationships, communication, boundaries and difficult conversations." },
  { name: "Kevin Kelly", lane: "Niche, audience, long-term opportunity and emerging patterns." },
  { name: "Pat Flynn", lane: "Practical small-business strategy, trust and sustainable monetization." },
  { name: "Ali Abdaal", lane: "Founder workload, energy, systems and sustainable productivity." },
  { name: "Jane McGonigal", lane: "Motivation, milestones, visible progress and achievable stages." },
];

const NAMING_MENTORS: Mentor[] = [
  { name: "Alexandra Watkins", lane: "Consumer naming, sticky language and SMILE/SCRATCH review." },
  { name: "David Placek", lane: "Distinctiveness, sound symbolism and evocative/invented naming." },
  { name: "Rob Meyerson", lane: "Naming brief, conflict prescreening, shortlist discipline and legal handoff." },
];

const DEFAULT_TASKS: TodayTask[] = [
  { id: "casevoice-practice", text: "Practice the CASEVOICE speaking pack for 10 minutes.", done: false },
  { id: "wah-paperwork", text: "Review the Wild Acres Pennsylvania questions and send/prepare the state inquiries.", done: false },
  { id: "founder-os", text: "Retire the obsolete dashboard auto-launch and move the Founder OS revamp forward.", done: false },
];

function loadTasks(): TodayTask[] {
  try {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}:todayTasks`);
    if (!saved) return DEFAULT_TASKS;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : DEFAULT_TASKS;
  } catch {
    return DEFAULT_TASKS;
  }
}

function statusColor(status: ProjectStatus) {
  if (status === "NOW") return COLORS.green;
  if (status === "BLOCKED") return COLORS.red;
  if (status === "DONE") return COLORS.blue;
  return COLORS.yellow;
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border p-5 md:p-6 ${className}`}
      style={{ backgroundColor: COLORS.panel, borderColor: COLORS.border }}
    >
      {children}
    </section>
  );
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ color: COLORS.gold }}>
      {children}
    </div>
  );
}

function TodayView() {
  const [tasks, setTasks] = useState<TodayTask[]>(loadTasks);
  const [lowEnergy, setLowEnergy] = useState(() => localStorage.getItem(`${STORAGE_PREFIX}:lowEnergy`) === "true");
  const [newTask, setNewTask] = useState("");

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}:todayTasks`, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}:lowEnergy`, String(lowEnergy));
  }, [lowEnergy]);

  const visibleTasks = lowEnergy ? tasks.filter((task) => !task.done).slice(0, 1) : tasks;
  const nextTask = tasks.find((task) => !task.done);

  function toggleTask(id: string) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)));
  }

  function updateTask(id: string, text: string) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, text } : task)));
  }

  function addTask() {
    const text = newTask.trim();
    if (!text) return;
    setTasks((current) => [...current, { id: `task-${Date.now()}`, text, done: false }]);
    setNewTask("");
  }

  function removeTask(id: string) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  const todayText = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date()),
    []
  );

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <SmallLabel>Today</SmallLabel>
            <h1 className="mt-2 text-3xl md:text-4xl font-bold" style={{ color: COLORS.text }}>
              {todayText}
            </h1>
            <p className="mt-3 max-w-3xl text-base md:text-lg leading-relaxed" style={{ color: COLORS.muted }}>
              Build Vogtcom into a real revenue-producing, location-independent company. Close what can be closed internally and stop coding around external blockers.
            </p>
          </div>
          <button
            onClick={() => setLowEnergy((value) => !value)}
            className="rounded-xl border px-5 py-3 text-base font-bold whitespace-nowrap"
            style={{
              borderColor: lowEnergy ? COLORS.gold : COLORS.border,
              backgroundColor: lowEnergy ? "rgba(210,179,90,0.12)" : COLORS.panel2,
              color: lowEnergy ? COLORS.gold : COLORS.text,
            }}
          >
            {lowEnergy ? "LOW ENERGY: ON" : "LOW ENERGY: OFF"}
          </button>
        </div>
      </Panel>

      {lowEnergy && (
        <Panel>
          <SmallLabel>Only Thing To Look At</SmallLabel>
          <div className="mt-3 text-2xl font-bold leading-snug" style={{ color: COLORS.text }}>
            {nextTask ? nextTask.text : "Everything on today's list is done."}
          </div>
        </Panel>
      )}

      <Panel>
        <div className="flex items-end justify-between gap-4">
          <div>
            <SmallLabel>Founder Tasks</SmallLabel>
            <h2 className="mt-2 text-2xl font-bold">Keep today small and tangible.</h2>
          </div>
          <div className="text-sm" style={{ color: COLORS.dim }}>
            {tasks.filter((task) => task.done).length}/{tasks.length} done
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {visibleTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-start gap-3 rounded-xl border p-4"
              style={{ backgroundColor: COLORS.panel2, borderColor: COLORS.border }}
            >
              <button
                aria-label={task.done ? "Mark task not done" : "Mark task done"}
                onClick={() => toggleTask(task.id)}
                className="mt-1 h-7 w-7 flex-shrink-0 rounded-lg border text-lg font-bold"
                style={{
                  borderColor: task.done ? COLORS.green : COLORS.dim,
                  color: task.done ? COLORS.green : COLORS.muted,
                }}
              >
                {task.done ? "✓" : ""}
              </button>
              <textarea
                value={task.text}
                onChange={(event) => updateTask(task.id, event.target.value)}
                rows={2}
                className="min-h-[56px] flex-1 resize-y rounded-lg border px-3 py-2 text-base outline-none"
                style={{
                  backgroundColor: COLORS.bg,
                  borderColor: COLORS.border,
                  color: task.done ? COLORS.dim : COLORS.text,
                  textDecoration: task.done ? "line-through" : "none",
                }}
              />
              {!lowEnergy && (
                <button
                  onClick={() => removeTask(task.id)}
                  className="rounded-lg border px-3 py-2 text-sm font-bold"
                  style={{ borderColor: COLORS.border, color: COLORS.dim }}
                >
                  REMOVE
                </button>
              )}
            </div>
          ))}
        </div>

        {!lowEnergy && (
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") addTask();
              }}
              placeholder="Add one real founder task"
              className="flex-1 rounded-xl border px-4 py-3 text-base outline-none"
              style={{ backgroundColor: COLORS.bg, borderColor: COLORS.border, color: COLORS.text }}
            />
            <button
              onClick={addTask}
              className="rounded-xl border px-5 py-3 font-bold"
              style={{ borderColor: COLORS.gold, color: COLORS.gold }}
            >
              ADD TASK
            </button>
          </div>
        )}
      </Panel>

      {!lowEnergy && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel>
            <SmallLabel>Company Bottleneck</SmallLabel>
            <div className="mt-3 text-xl font-bold" style={{ color: COLORS.text }}>
              Qualified legal review is blocking CASEVOICE external validation and my420 outside testing.
            </div>
            <p className="mt-3 leading-relaxed" style={{ color: COLORS.muted }}>
              More internal CASEVOICE product work does not open that gate. Wild Acres exists partly to attack the funding problem rather than hide from it.
            </p>
          </Panel>
          <Panel>
            <SmallLabel>External Blockers</SmallLabel>
            <div className="mt-3 space-y-2 text-base" style={{ color: COLORS.muted }}>
              <div>• CASEVOICE: counsel classification/review.</div>
              <div>• my420journal: cannabis-specific counsel before outside testing.</div>
              <div>• Wild Acres: Pennsylvania classification, later inspection/suppliers/events.</div>
              <div>• MyTravBot: real traveler evidence after the handheld core works.</div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function ProjectsView() {
  return (
    <div>
      <SmallLabel>Projects</SmallLabel>
      <h1 className="mt-2 text-3xl font-bold">Four current workstreams. No fourth software startup.</h1>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {PROJECTS.map((project) => (
          <Panel key={project.name}>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-bold" style={{ color: COLORS.text }}>
                {project.name}
              </h2>
              <span
                className="rounded-full border px-3 py-1 text-xs font-black tracking-wider"
                style={{ color: statusColor(project.status), borderColor: statusColor(project.status) }}
              >
                {project.status}
              </span>
            </div>
            <div className="mt-5 space-y-4">
              <ProjectField label="Job In Company" text={project.job} />
              <ProjectField label="Current Gate" text={project.gate} />
              <ProjectField label="Next Founder Action" text={project.next} />
              <ProjectField label="External Dependency" text={project.external} />
              <div>
                <SmallLabel>Latest Control</SmallLabel>
                <a
                  href={project.controlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-base font-bold underline underline-offset-4"
                  style={{ color: COLORS.blue }}
                >
                  {project.control}
                </a>
              </div>
              <div className="text-xs" style={{ color: COLORS.dim }}>
                Last reconciled: {project.verified}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function ProjectField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <SmallLabel>{label}</SmallLabel>
      <p className="mt-1 text-base leading-relaxed" style={{ color: COLORS.muted }}>
        {text}
      </p>
    </div>
  );
}

function EvidenceView() {
  return (
    <div>
      <SmallLabel>Evidence</SmallLabel>
      <h1 className="mt-2 text-3xl font-bold">Current controls only.</h1>
      <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: COLORS.muted }}>
        Drive remains the source of truth. This screen links to the small set of documents that answer current-state questions. Old files stay in Drive history instead of becoming another room to navigate.
      </p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {EVIDENCE_LINKS.map((item) => (
          <a
            key={item.title}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl border p-5 transition-transform hover:-translate-y-0.5"
            style={{ backgroundColor: COLORS.panel, borderColor: COLORS.border }}
          >
            <div className="text-lg font-bold" style={{ color: COLORS.text }}>
              {item.title}
            </div>
            <div className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.muted }}>
              {item.note}
            </div>
            <div className="mt-4 text-xs font-black tracking-wider" style={{ color: COLORS.blue }}>
              OPEN CURRENT SOURCE →
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

const MENTOR_SETS: Record<string, string[]> = {
  "Priorities / Bottlenecks": ["Dan Martell", "Ali Abdaal", "Jane McGonigal"],
  "Customer Discovery": ["Justin Welsh", "Pat Flynn", "Rory Sutherland"],
  "Positioning / Marketing": ["Rory Sutherland", "Justin Welsh", "Kevin Kelly"],
  "Difficult Conversation": ["Esther Perel", "Dan Martell"],
  "Long-Term Direction": ["Kevin Kelly", "Pat Flynn", "Dan Martell"],
  "Naming / Brand": ["Rob Meyerson", "Alexandra Watkins", "David Placek"],
};

function MentorRoomView() {
  const [selected, setSelected] = useState("Priorities / Bottlenecks");
  const activeNames = MENTOR_SETS[selected] ?? [];

  return (
    <div>
      <SmallLabel>Mentor Room</SmallLabel>
      <h1 className="mt-2 text-3xl font-bold">Use the smallest useful board.</h1>
      <p className="mt-3 max-w-3xl text-base leading-relaxed" style={{ color: COLORS.muted }}>
        This is decision support, not a fictional employee directory. Pick the problem. Use one to three relevant lenses. The old 30+ character roster stays archived in code until anything useful is separated from the character layer.
      </p>

      <Panel className="mt-5">
        <SmallLabel>Problem Type</SmallLabel>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(MENTOR_SETS).map((label) => (
            <button
              key={label}
              onClick={() => setSelected(label)}
              className="rounded-xl border px-4 py-3 text-sm font-bold"
              style={{
                borderColor: selected === label ? COLORS.gold : COLORS.border,
                color: selected === label ? COLORS.gold : COLORS.muted,
                backgroundColor: selected === label ? "rgba(210,179,90,0.10)" : COLORS.panel2,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {activeNames.map((name) => {
            const mentor = [...MENTORS, ...NAMING_MENTORS].find((item) => item.name === name);
            return (
              <div key={name} className="rounded-xl border p-4" style={{ borderColor: COLORS.border, backgroundColor: COLORS.bg }}>
                <div className="text-lg font-bold" style={{ color: COLORS.text }}>
                  {name}
                </div>
                <div className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.muted }}>
                  {mentor?.lane}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <SmallLabel>Active Founder Board</SmallLabel>
          <div className="mt-4 space-y-3">
            {MENTORS.map((mentor) => (
              <div key={mentor.name} className="border-b pb-3 last:border-b-0" style={{ borderColor: COLORS.border }}>
                <div className="font-bold" style={{ color: COLORS.text }}>{mentor.name}</div>
                <div className="mt-1 text-sm" style={{ color: COLORS.muted }}>{mentor.lane}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <SmallLabel>Naming Specialists — Only When Needed</SmallLabel>
          <div className="mt-4 space-y-3">
            {NAMING_MENTORS.map((mentor) => (
              <div key={mentor.name} className="border-b pb-3 last:border-b-0" style={{ borderColor: COLORS.border }}>
                <div className="font-bold" style={{ color: COLORS.text }}>{mentor.name}</div>
                <div className="mt-1 text-sm" style={{ color: COLORS.muted }}>{mentor.lane}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border p-4" style={{ borderColor: COLORS.gold, backgroundColor: "rgba(210,179,90,0.08)" }}>
            <div className="font-bold" style={{ color: COLORS.gold }}>Rule</div>
            <div className="mt-2 text-sm leading-relaxed" style={{ color: COLORS.muted }}>
              Naming candidates do not reach Daniel until preliminary conflict screening has been attempted.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SystemView() {
  const [startupStatus, setStartupStatus] = useState(() => localStorage.getItem(`${STORAGE_PREFIX}:startupStatus`) || "UNKNOWN");

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}:startupStatus`, startupStatus);
  }, [startupStatus]);

  return (
    <div>
      <SmallLabel>System</SmallLabel>
      <h1 className="mt-2 text-3xl font-bold">Only controls that help run the company.</h1>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel>
          <SmallLabel>Founder OS</SmallLabel>
          <div className="mt-4 space-y-3 text-base" style={{ color: COLORS.muted }}>
            <div><strong style={{ color: COLORS.text }}>Branch:</strong> revamp/north-star-founder-os-20260825</div>
            <div><strong style={{ color: COLORS.text }}>Persistence:</strong> browser localStorage for Today UI state only.</div>
            <div><strong style={{ color: COLORS.text }}>Source of truth:</strong> Google Drive control documents.</div>
            <div><strong style={{ color: COLORS.text }}>Product/code truth:</strong> GitHub repositories.</div>
            <div><strong style={{ color: COLORS.text }}>CASEVOICE validation CRM:</strong> remains separate.</div>
          </div>
        </Panel>

        <Panel>
          <SmallLabel>Unwanted Auto-Launch</SmallLabel>
          <div className="mt-3 text-lg font-bold" style={{ color: startupStatus === "DISABLED" ? COLORS.green : COLORS.yellow }}>
            {startupStatus}
          </div>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: COLORS.muted }}>
            A VBS launcher existed in the old Founder CRM ecosystem, but the exact Windows trigger causing the unwanted startup window still needs to be identified before deleting anything.
          </p>
          <div className="mt-4 space-y-2 text-sm" style={{ color: COLORS.muted }}>
            <div>1. Check <strong style={{ color: COLORS.text }}>shell:startup</strong>.</div>
            <div>2. Check Task Manager → Startup apps.</div>
            <div>3. Check Task Scheduler Library.</div>
            <div>4. Check Desktop/WORKSPACE startup shortcuts and VBS scripts.</div>
            <div>5. Check browser startup/restore settings.</div>
          </div>
          <div className="mt-4 flex gap-2">
            {["UNKNOWN", "FOUND", "DISABLED"].map((status) => (
              <button
                key={status}
                onClick={() => setStartupStatus(status)}
                className="rounded-lg border px-3 py-2 text-xs font-bold"
                style={{ borderColor: startupStatus === status ? COLORS.gold : COLORS.border, color: startupStatus === status ? COLORS.gold : COLORS.muted }}
              >
                {status}
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <SmallLabel>Archived / Not Active</SmallLabel>
          <div className="mt-3 space-y-2 text-sm" style={{ color: COLORS.muted }}>
            <div>• Startup Operations Dashboard / old vision-board style control surface.</div>
            <div>• Legacy fictional office rooms and 30+ staff/persona directory.</div>
            <div>• Engine Room / Scotty device-monitoring concept.</div>
            <div>• Duplicate email client and duplicate Drive/file-room concepts.</div>
          </div>
        </Panel>

        <Panel>
          <SmallLabel>Acceptance Test</SmallLabel>
          <div className="mt-3 space-y-2 text-base" style={{ color: COLORS.muted }}>
            <div>Can I tell what I am doing today?</div>
            <div>Can I see which project is blocked?</div>
            <div>Can I see what needs money/counsel/regulator/another person?</div>
            <div>Can I see the next action for each current project?</div>
            <div>Can I open the source proving the answer?</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>(() => {
    const saved = localStorage.getItem(`${STORAGE_PREFIX}:activeTab`) as MainTab | null;
    return saved && MAIN_TABS.includes(saved) ? saved : "TODAY";
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}:activeTab`, activeTab);
  }, [activeTab]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg, color: COLORS.text, fontFamily: "Inter, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: "rgba(7,17,31,0.97)", borderColor: COLORS.border }}>
        <div className="mx-auto max-w-[1500px] px-4 md:px-6 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xl font-black tracking-wide" style={{ color: COLORS.gold }}>VOGTCOM FOUNDER OS</div>
              <div className="mt-1 text-sm" style={{ color: COLORS.dim }}>North Star control surface — August 2026</div>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {MAIN_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="rounded-xl border px-4 md:px-5 py-3 text-sm font-black tracking-wide whitespace-nowrap"
                  style={{
                    backgroundColor: activeTab === tab ? COLORS.panel2 : "transparent",
                    borderColor: activeTab === tab ? COLORS.gold : COLORS.border,
                    color: activeTab === tab ? COLORS.text : COLORS.muted,
                  }}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 md:px-6 py-6 md:py-8">
        {activeTab === "TODAY" && <TodayView />}
        {activeTab === "PROJECTS" && <ProjectsView />}
        {activeTab === "EVIDENCE" && <EvidenceView />}
        {activeTab === "MENTOR ROOM" && <MentorRoomView />}
        {activeTab === "SYSTEM" && <SystemView />}
      </main>
    </div>
  );
}
