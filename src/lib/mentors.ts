export interface TeamMember {
  name: string;
  department: string;
  skills: string[];
}

export const TEAM_ROSTER: TeamMember[] = [
  { name: "JULIE",    department: "Facilitation",       skills: ["Conversation control", "Routing speakers", "Tracking tasks and notes"] },
  { name: "MARK",     department: "Strategy",            skills: ["Vision and positioning", "Growth direction", "Market analysis"] },
  { name: "JAMES",    department: "Communication",       skills: ["Messaging clarity", "Tone and voice", "Copywriting"] },
  { name: "DOC",      department: "Critical Systems",    skills: ["User safety", "Risk awareness", "Emotional context"] },
  { name: "TECHGUY",  department: "Critical Systems",    skills: ["Engineering systems", "Debugging", "Implementation"] },
  { name: "SIGMA",    department: "Execution",           skills: ["Task tracking", "Process flow", "Efficiency"] },
  { name: "CIPHER",   department: "Critical Systems",    skills: ["Data privacy", "Security", "Trust systems"] },
  { name: "RICK",     department: "Critical Systems",    skills: ["Risk detection", "Failure points", "What could break"] },
  { name: "ALEX",     department: "User & Experience",   skills: ["UX design", "Layout clarity", "User flow"] },
  { name: "PAUL",     department: "Execution",           skills: ["Priority setting", "Focus control", "Decision order"] },
  { name: "PAT",      department: "Intelligence",        skills: ["Pattern recognition", "Trend detection", "Insight linking"] },
  { name: "ULYSES",   department: "User & Experience",   skills: ["User journey", "Real-world behavior", "Perspective grounding"] },
  { name: "ATK",      department: "Legal",               skills: ["Aggressive legal risk", "Exposure scenarios", "Worst-case framing"] },
  { name: "DEF",      department: "Legal",               skills: ["Protection strategy", "Liability reduction", "Defensive framing"] },
  { name: "SCOUT",    department: "Strategy",            skills: ["Market research", "Opportunity spotting", "Competitive awareness"] },
  { name: "RAY",      department: "Operations",          skills: ["Real-world practicality", "Street-level logic", "Feasibility"] },
  { name: "KAREN",    department: "Operations",          skills: ["Quality control", "Standards enforcement", "Detail checking"] },
  { name: "WATCHER",  department: "Operations",          skills: ["Memory tracking", "Documentation", "Continuity"] },
  { name: "MAILMAN",  department: "Communication",       skills: ["Message delivery", "Routing clarity", "Follow-ups"] },
  { name: "JERRY",    department: "Intelligence",        skills: ["Blind spots", "Missing logic", "Gaps in thinking"] },
  { name: "THAT GUY", department: "Operations",          skills: ["System gaps", "Handoff failures", "Edge cases"] },
];

export const ALL_MENTOR_NAMES = TEAM_ROSTER.map((m) => m.name);

export const FALLBACK_MENTOR_NAMES = ALL_MENTOR_NAMES;
