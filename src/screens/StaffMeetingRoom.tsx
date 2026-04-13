import React, { useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'brainstorm' | 'command';
type MentorStatus = 'idle' | 'assigned' | 'working' | 'ready' | 'blocked';
type PanelTab = 'notes' | 'tasks' | 'files' | 'excerpts';
type VoiceStyle = 'verbatim' | 'cleaned' | 'executive_clean';

type MentorName =
  | 'PREZ'
  | 'JAMISON'
  | 'DOC'
  | 'TECH-9'
  | 'SAM'
  | 'CIPHER';

type Mentor = {
  name: MentorName;
  active: boolean;
  status: MentorStatus;
  currentTaskId?: string;
  lastOutput?: string;
};

type Message = {
  id: string;
  role: 'user' | 'mentor' | 'system';
  speaker: string;
  text: string;
  timestamp: string;
};

type TaskItem = {
  id: string;
  mentor: MentorName;
  text: string;
  status: MentorStatus;
  createdAt: string;
  updatedAt: string;
};

type SideNote = {
  id: string;
  text: string;
  timestamp: string;
};

type Excerpt = {
  id: string;
  text: string;
  source: string;
  timestamp: string;
};

type FileItem = {
  id: string;
  name: string;
  type: string;
  sizeLabel: string;
  previewText: string;
  timestamp: string;
};

type PersistedState = {
  mode: Mode;
  mentors: Mentor[];
  messages: Message[];
  tasks: TaskItem[];
  notes: SideNote[];
  excerpts: Excerpt[];
  files: FileItem[];
  voiceStyle: VoiceStyle;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const STORAGE_KEY = 'staff-meeting-room-v1';

const initialMentors: Mentor[] = [
  { name: 'PREZ', active: true, status: 'idle' },
  { name: 'JAMISON', active: true, status: 'idle' },
  { name: 'DOC', active: true, status: 'idle' },
  { name: 'TECH-9', active: true, status: 'idle' },
  { name: 'SAM', active: true, status: 'idle' },
  { name: 'CIPHER', active: true, status: 'idle' },
];

function createId() {
  return Math.random().toString(36).slice(2, 10);
}

function nowLabel() {
  return new Date().toLocaleString();
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cleanTranscript(text: string, style: VoiceStyle) {
  let result = text.replace(/\s+/g, ' ').trim();

  if (!result) return '';

  result = result.replace(/\bi\b/g, 'I');
  result = result.replace(/\bim\b/gi, "I'm");
  result = result.replace(/\bdont\b/gi, "don't");
  result = result.replace(/\bcant\b/gi, "can't");
  result = result.replace(/\bwont\b/gi, "won't");
  result = result.replace(/\bive\b/gi, "I've");
  result = result.replace(/\bid\b/gi, "I'd");

  if (!/[.!?]$/.test(result)) {
    result += '.';
  }

  result = result.charAt(0).toUpperCase() + result.slice(1);

  if (style === 'executive_clean') {
    result = result
      .replace(/\s+like\s+/gi, ' ')
      .replace(/\s+you know\s*/gi, ' ')
      .replace(/\s+sort of\s+/gi, ' ')
      .replace(/\s+kind of\s+/gi, ' ');
    result = result.replace(/\s+/g, ' ').trim();
    if (result && !/[.!?]$/.test(result)) result += '.';
  }

  return result;
}

function mentorReply(mentor: MentorName, taskText: string, mode: Mode) {
  const short = taskText.trim();

  if (mode === 'brainstorm') {
    switch (mentor) {
      case 'PREZ':
        return `The strategic angle is this: ${short}. We need a version that is clear, adoptable, and worth acting on now.`;
      case 'JAMISON':
        return `The wording can be sharper. For ${short}, I would keep it human, direct, and easy to scan.`;
      case 'DOC':
        return `Let’s slow it down. For ${short}, I want the flow to feel clear, calm, and grounded for the person using it.`;
      case 'TECH-9':
        return `Technically, ${short} is doable. I’d build the simplest working version first, then harden it.`;
      case 'SAM':
        return `Operationally, ${short} needs a cleaner sequence so it can actually run in a meeting without friction.`;
      case 'CIPHER':
        return `From a trust and privacy angle, ${short} should stay minimal, legible, and controlled.`;
      default:
        return `I’ve got thoughts on ${short}.`;
    }
  }

  switch (mentor) {
    case 'PREZ':
      return `Decision: pursue the clearest version of ${short}. Key insight: the room needs speed and authority. Risk: overbuilding. Action: keep it lean and ship the smallest strong version.`;
    case 'JAMISON':
      return `Decision: rewrite ${short} for clarity. Key insight: confusing language kills trust fast. Risk: too much system-speak. Action: keep the wording human and direct.`;
    case 'DOC':
      return `Decision: simplify the experience around ${short}. Key insight: clarity lowers stress. Risk: cognitive overload. Action: reduce moving parts and make the next step obvious.`;
    case 'TECH-9':
      return `Decision: build ${short} as a contained unit first. Key insight: one stable file beats a half-connected system. Risk: hidden edge cases. Action: implement, test, then layer on.`;
    case 'SAM':
      return `Decision: sequence ${short} into a repeatable flow. Key insight: meetings fail when the tool adds friction. Risk: too many controls at once. Action: keep the main path tight.`;
    case 'CIPHER':
      return `Decision: keep ${short} scoped and auditable. Key insight: trust comes from boundaries. Risk: unclear data handling. Action: make behavior obvious and avoid silent magic.`;
    default:
      return `Completed: ${short}.`;
  }
}

export default function StaffMeetingRoom() {
  const [mode, setMode] = useState<Mode>('brainstorm');
  const [mentors, setMentors] = useState<Mentor[]>(initialMentors);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [notes, setNotes] = useState<SideNote[]>([]);
  const [excerpts, setExcerpts] = useState<Excerpt[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<PanelTab>('tasks');
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('cleaned');
  const [isListening, setIsListening] = useState(false);
  const [audioReviewNote, setAudioReviewNote] = useState('');
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: PersistedState = JSON.parse(raw);

      if (parsed.mode) setMode(parsed.mode);
      if (parsed.mentors?.length) setMentors(parsed.mentors);
      if (parsed.messages) setMessages(parsed.messages);
      if (parsed.tasks) setTasks(parsed.tasks);
      if (parsed.notes) setNotes(parsed.notes);
      if (parsed.excerpts) setExcerpts(parsed.excerpts);
      if (parsed.files) setFiles(parsed.files);
      if (parsed.voiceStyle) setVoiceStyle(parsed.voiceStyle);
    } catch (error) {
      console.error('Failed to load saved session:', error);
    }
  }, []);

  useEffect(() => {
    const payload: PersistedState = {
      mode,
      mentors,
      messages,
      tasks,
      notes,
      excerpts,
      files,
      voiceStyle,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }, [mode, mentors, messages, tasks, notes, excerpts, files, voiceStyle]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const activeMentorCount = useMemo(
    () => mentors.filter((m) => m.active).length,
    [mentors]
  );

  const toggleMentor = (name: MentorName) => {
    setMentors((prev) =>
      prev.map((m) => (m.name === name ? { ...m, active: !m.active } : m))
    );
  };

  const updateMentorStatus = (mentorName: MentorName, status: MentorStatus, taskId?: string) => {
    setMentors((prev) =>
      prev.map((m) =>
        m.name === mentorName
          ? {
              ...m,
              status,
              currentTaskId: taskId ?? m.currentTaskId,
            }
          : m
      )
    );
  };

  const addMessage = (role: Message['role'], speaker: string, text: string) => {
    const message: Message = {
      id: createId(),
      role,
      speaker,
      text,
      timestamp: nowLabel(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const createTask = (mentorName: MentorName, text: string) => {
    const timestamp = nowLabel();
    const task: TaskItem = {
      id: createId(),
      mentor: mentorName,
      text,
      status: 'assigned',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setTasks((prev) => [...prev, task]);
    updateMentorStatus(mentorName, 'assigned', task.id);

    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: 'working', updatedAt: nowLabel() }
            : t
        )
      );
      updateMentorStatus(mentorName, 'working', task.id);
    }, 700);

    setTimeout(() => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, status: 'ready', updatedAt: nowLabel() }
            : t
        )
      );
      updateMentorStatus(mentorName, 'ready', task.id);
    }, 1800);
  };

  const tryParseTask = (text: string) => {
    const match = text.match(/^\s*(PREZ|JAMISON|DOC|TECH-9|SAM|CIPHER)\s*:\s*(.+)$/i);
    if (!match) return false;

    const mentorName = match[1].toUpperCase() as MentorName;
    const taskText = match[2].trim();
    if (!taskText) return false;

    createTask(mentorName, taskText);
    addMessage('system', 'SYSTEM', `Task assigned to ${mentorName}: ${taskText}`);
    setActiveTab('tasks');
    return true;
  };

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    addMessage('user', 'YOU', trimmed);
    const createdTask = tryParseTask(trimmed);

    if (!createdTask && mode === 'brainstorm') {
      const activeMentors = mentors.filter((m) => m.active).slice(0, 2);
      activeMentors.forEach((mentor, index) => {
        setTimeout(() => {
          addMessage('mentor', mentor.name, mentorReply(mentor.name, trimmed, 'brainstorm'));
        }, 350 + index * 250);
      });
    }

    setInput('');
  };

  const addSideNote = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const note: SideNote = {
      id: createId(),
      text: trimmed,
      timestamp: nowLabel(),
    };

    setNotes((prev) => [note, ...prev]);
    setActiveTab('notes');
    setInput('');
  };

  const callOnMentor = (mentorName: MentorName) => {
    const mentor = mentors.find((m) => m.name === mentorName);
    const task = tasks.find((t) => t.id === mentor?.currentTaskId);

    if (!mentor || mentor.status !== 'ready' || !task) return;

    const reply = mentorReply(mentorName, task.text, 'command');

    addMessage('mentor', mentorName, reply);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: 'idle', updatedAt: nowLabel() }
          : t
      )
    );

    setMentors((prev) =>
      prev.map((m) =>
        m.name === mentorName
          ? { ...m, status: 'idle', lastOutput: reply, currentTaskId: undefined }
          : m
      )
    );
  };

  const saveExcerptFromMessage = (message: Message) => {
    const excerpt: Excerpt = {
      id: createId(),
      text: message.text,
      source: `${message.speaker} at ${message.timestamp}`,
      timestamp: nowLabel(),
    };

    setExcerpts((prev) => [excerpt, ...prev]);
    setActiveTab('excerpts');
  };

  const clearSession = () => {
    setMode('brainstorm');
    setMentors(initialMentors);
    setMessages([]);
    setTasks([]);
    setNotes([]);
    setExcerpts([]);
    setFiles([]);
    setInput('');
    setAudioReviewNote('');
    localStorage.removeItem(STORAGE_KEY);
  };

  const startVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAudioReviewNote('Voice input is not supported in this browser.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      let finalText = '';

      recognition.onstart = () => {
        setIsListening(true);
        setAudioReviewNote('Listening...');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';

        for (let i = 0; i < event.results.length; i += 1) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += ` ${event.results[i][0].transcript}`;
          }
        }

        const liveText = finalText || transcript;
        setInput(cleanTranscript(liveText, voiceStyle));
      };

      recognition.onerror = () => {
        setAudioReviewNote('Audio may not have come through clearly.');
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setAudioReviewNote(
          finalText.trim()
            ? 'Check highlighted words if you want before sending.'
            : ''
        );

        if (finalText.trim()) {
          setInput(cleanTranscript(finalText, voiceStyle));
        }
      };

      recognition.start();
    } catch (error) {
      console.error(error);
      setAudioReviewNote('Voice input could not start.');
      setIsListening(false);
    }
  };

  const stopVoiceInput = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  };

  const onChooseFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;

    for (const file of selected) {
      const lower = file.name.toLowerCase();
      const allowed =
        lower.endsWith('.pdf') || lower.endsWith('.txt');

      if (!allowed) {
        addMessage('system', 'SYSTEM', `Skipped unsupported file: ${file.name}`);
        continue;
      }

      let previewText = 'PDF attached as reference.';
      if (lower.endsWith('.txt')) {
        try {
          previewText = (await file.text()).slice(0, 4000);
        } catch {
          previewText = 'Text preview unavailable.';
        }
      }

      const item: FileItem = {
        id: createId(),
        name: file.name,
        type: file.type || (lower.endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
        sizeLabel: sizeLabel(file.size),
        previewText,
        timestamp: nowLabel(),
      };

      setFiles((prev) => [item, ...prev]);
      addMessage('system', 'SYSTEM', `File attached: ${file.name}`);
    }

    setActiveTab('files');
    event.target.value = '';
  };

  const statusDotColor = (status: MentorStatus) => {
    switch (status) {
      case 'assigned':
        return '#3A6EA5';
      case 'working':
        return '#8BA4C2';
      case 'ready':
        return '#3FB950';
      case 'blocked':
        return '#D9534F';
      default:
        return '#61718f';
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D1B2E',
        color: '#FFFFFF',
        fontFamily: 'Arial, sans-serif',
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          borderRight: '1px solid rgba(201,168,76,0.28)',
        }}
      >
        <div
          style={{
            padding: '18px 20px 12px',
            borderBottom: '1px solid rgba(201,168,76,0.28)',
            background: '#12233b',
          }}
        >
          <div
            style={{
              fontFamily: 'Georgia, serif',
              fontSize: '34px',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '12px',
            }}
          >
            Staff Meeting Room
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <button
              onClick={() => setMode('brainstorm')}
              style={{
                padding: '12px 18px',
                background: mode === 'brainstorm' ? '#C9A84C' : '#1B2A4A',
                color: mode === 'brainstorm' ? '#08111d' : '#FFFFFF',
                border: '1px solid #C9A84C',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Brainstorm
            </button>

            <button
              onClick={() => setMode('command')}
              style={{
                padding: '12px 18px',
                background: mode === 'command' ? '#C9A84C' : '#1B2A4A',
                color: mode === 'command' ? '#08111d' : '#FFFFFF',
                border: '1px solid #C9A84C',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Command
            </button>

            <div
              style={{
                padding: '12px 16px',
                background: '#1B2A4A',
                border: '1px solid rgba(201,168,76,0.32)',
                color: '#8BA4C2',
                fontSize: '14px',
              }}
            >
              Mode: <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{mode}</span>
            </div>

            <div
              style={{
                padding: '12px 16px',
                background: '#1B2A4A',
                border: '1px solid rgba(201,168,76,0.32)',
                color: '#8BA4C2',
                fontSize: '14px',
              }}
            >
              Active mentors:{' '}
              <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{activeMentorCount}</span>
            </div>

            <button
              onClick={clearSession}
              style={{
                padding: '12px 18px',
                background: '#1B2A4A',
                color: '#FFFFFF',
                border: '1px solid #8BA4C2',
                fontWeight: 700,
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Reset Session
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid rgba(201,168,76,0.22)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '14px',
            }}
          >
            {mentors.map((mentor) => (
              <button
                key={mentor.name}
                onClick={() => toggleMentor(mentor.name)}
                style={{
                  minHeight: '118px',
                  background: mentor.active ? '#243b63' : '#1B2A4A',
                  color: '#FFFFFF',
                  border: mentor.active
                    ? '2px solid #C9A84C'
                    : '1px solid rgba(139,164,194,0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  boxShadow: mentor.active
                    ? '0 0 0 1px rgba(201,168,76,0.35)'
                    : 'none',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '999px',
                    background: statusDotColor(mentor.status),
                  }}
                />
                <div
                  style={{
                    fontFamily: 'Georgia, serif',
                    fontSize: '22px',
                    fontWeight: 700,
                    color: mentor.active ? '#C9A84C' : '#FFFFFF',
                    textAlign: 'center',
                    lineHeight: 1.1,
                  }}
                >
                  {mentor.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: '#8BA4C2',
                  }}
                >
                  {mentor.status}
                </div>
                {mode === 'command' && mentor.status === 'ready' ? (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#C9A84C',
                      fontWeight: 700,
                    }}
                  >
                    Ready to call on
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: '18px 20px',
            overflowY: 'auto',
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                color: '#8BA4C2',
                fontSize: '18px',
              }}
            >
              Start typing, use the mic, or assign a task like: PREZ: draft the pitch.
            </div>
          ) : null}

          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                background:
                  message.role === 'user'
                    ? '#132740'
                    : message.role === 'mentor'
                    ? '#1B2A4A'
                    : '#162031',
                border:
                  message.role === 'user'
                    ? '1px solid rgba(201,168,76,0.25)'
                    : '1px solid rgba(139,164,194,0.18)',
                padding: '14px 16px',
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    color:
                      message.role === 'mentor' ? '#C9A84C' : '#FFFFFF',
                  }}
                >
                  {message.speaker}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#8BA4C2',
                  }}
                >
                  {message.timestamp}
                </div>
                <button
                  onClick={() => saveExcerptFromMessage(message)}
                  style={{
                    marginLeft: 'auto',
                    padding: '8px 10px',
                    background: '#0D1B2E',
                    color: '#C9A84C',
                    border: '1px solid rgba(201,168,76,0.42)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save Excerpt
                </button>
              </div>

              <div
                style={{
                  fontSize: '18px',
                  lineHeight: 1.5,
                  color: '#FFFFFF',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            borderTop: '1px solid rgba(201,168,76,0.22)',
            background: '#12233b',
            padding: '16px 20px 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <button
              onClick={isListening ? stopVoiceInput : startVoiceInput}
              style={{
                padding: '12px 16px',
                background: isListening ? '#C9A84C' : '#1B2A4A',
                color: isListening ? '#08111d' : '#FFFFFF',
                border: '1px solid #C9A84C',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {isListening ? 'Stop Mic' : 'Mic'}
            </button>

            <select
              value={voiceStyle}
              onChange={(e) => setVoiceStyle(e.target.value as VoiceStyle)}
              style={{
                padding: '12px 14px',
                background: '#1B2A4A',
                color: '#FFFFFF',
                border: '1px solid rgba(201,168,76,0.35)',
              }}
            >
              <option value="verbatim">Verbatim</option>
              <option value="cleaned">Cleaned</option>
              <option value="executive_clean">Executive Clean</option>
            </select>

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '12px 16px',
                background: '#1B2A4A',
                color: '#FFFFFF',
                border: '1px solid rgba(201,168,76,0.35)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Upload File
            </button>

            <button
              onClick={addSideNote}
              style={{
                padding: '12px 16px',
                background: '#1B2A4A',
                color: '#FFFFFF',
                border: '1px solid rgba(201,168,76,0.35)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Side Note
            </button>

            <button
              onClick={sendMessage}
              style={{
                padding: '12px 18px',
                background: '#C9A84C',
                color: '#08111d',
                border: '1px solid #C9A84C',
                fontWeight: 800,
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Send
            </button>
          </div>

          <input
            ref={null}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type here, or assign a task like: TECH-9: build export flow"
            style={{
              width: '100%',
              padding: '16px 18px',
              background: '#1B2A4A',
              color: '#FFFFFF',
              border: '1px solid rgba(201,168,76,0.35)',
              fontSize: '18px',
              outline: 'none',
            }}
          />

          {audioReviewNote ? (
            <div
              style={{
                marginTop: '10px',
                fontSize: '13px',
                color: '#8BA4C2',
              }}
            >
              {audioReviewNote}
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,text/plain,application/pdf"
            multiple
            onChange={onChooseFiles}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      <div
        style={{
          minWidth: 0,
          background: '#12233b',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            padding: '18px 16px',
            borderBottom: '1px solid rgba(201,168,76,0.22)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
            }}
          >
            {(['notes', 'tasks', 'files', 'excerpts'] as PanelTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '11px 8px',
                  background: activeTab === tab ? '#C9A84C' : '#1B2A4A',
                  color: activeTab === tab ? '#08111d' : '#FFFFFF',
                  border: '1px solid rgba(201,168,76,0.42)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {activeTab === 'notes' && (
            <div>
              {notes.length === 0 ? (
                <div style={{ color: '#8BA4C2' }}>No side notes yet.</div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      background: '#1B2A4A',
                      border: '1px solid rgba(201,168,76,0.22)',
                      padding: '14px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#8BA4C2',
                        marginBottom: '8px',
                      }}
                    >
                      {note.timestamp}
                    </div>
                    <div
                      style={{
                        fontSize: '16px',
                        lineHeight: 1.5,
                      }}
                    >
                      {note.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div>
              {tasks.length === 0 ? (
                <div style={{ color: '#8BA4C2' }}>No tasks yet.</div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      background: '#1B2A4A',
                      border: '1px solid rgba(201,168,76,0.22)',
                      padding: '14px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        marginBottom: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          color: '#C9A84C',
                        }}
                      >
                        {task.mentor}
                      </div>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '999px',
                          background: statusDotColor(task.status),
                        }}
                      />
                      <div
                        style={{
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          color: '#8BA4C2',
                        }}
                      >
                        {task.status}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '16px',
                        lineHeight: 1.5,
                        marginBottom: '12px',
                      }}
                    >
                      {task.text}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        onClick={() => callOnMentor(task.mentor)}
                        disabled={task.status !== 'ready'}
                        style={{
                          padding: '10px 12px',
                          background: task.status === 'ready' ? '#C9A84C' : '#1a2841',
                          color: task.status === 'ready' ? '#08111d' : '#8BA4C2',
                          border: '1px solid rgba(201,168,76,0.42)',
                          fontWeight: 700,
                          cursor: task.status === 'ready' ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Call On
                      </button>

                      <button
                        onClick={() => {
                          setTasks((prev) =>
                            prev.map((t) =>
                              t.id === task.id
                                ? { ...t, status: 'blocked', updatedAt: nowLabel() }
                                : t
                            )
                          );
                          updateMentorStatus(task.mentor, 'blocked', task.id);
                        }}
                        style={{
                          padding: '10px 12px',
                          background: '#1a2841',
                          color: '#FFFFFF',
                          border: '1px solid rgba(139,164,194,0.32)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Mark Blocked
                      </button>

                      <button
                        onClick={() => {
                          setTasks((prev) =>
                            prev.map((t) =>
                              t.id === task.id
                                ? { ...t, status: 'ready', updatedAt: nowLabel() }
                                : t
                            )
                          );
                          updateMentorStatus(task.mentor, 'ready', task.id);
                        }}
                        style={{
                          padding: '10px 12px',
                          background: '#1a2841',
                          color: '#FFFFFF',
                          border: '1px solid rgba(139,164,194,0.32)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Mark Ready
                      </button>
                    </div>

                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '12px',
                        color: '#8BA4C2',
                      }}
                    >
                      Updated: {task.updatedAt}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div>
              {files.length === 0 ? (
                <div style={{ color: '#8BA4C2' }}>
                  No files attached yet. PDF and TXT only.
                </div>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      background: '#1B2A4A',
                      border: '1px solid rgba(201,168,76,0.22)',
                      padding: '14px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        color: '#C9A84C',
                        marginBottom: '6px',
                        wordBreak: 'break-word',
                      }}
                    >
                      {file.name}
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: '#8BA4C2',
                        marginBottom: '10px',
                      }}
                    >
                      {file.sizeLabel} • {file.timestamp}
                    </div>

                    <div
                      style={{
                        fontSize: '14px',
                        lineHeight: 1.5,
                        color: '#FFFFFF',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        background: '#0D1B2E',
                        padding: '10px',
                        border: '1px solid rgba(139,164,194,0.18)',
                      }}
                    >
                      {file.previewText}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'excerpts' && (
            <div>
              {excerpts.length === 0 ? (
                <div style={{ color: '#8BA4C2' }}>No saved excerpts yet.</div>
              ) : (
                excerpts.map((excerpt) => (
                  <div
                    key={excerpt.id}
                    style={{
                      background: '#1B2A4A',
                      border: '1px solid rgba(201,168,76,0.22)',
                      padding: '14px',
                      marginBottom: '12px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#8BA4C2',
                        marginBottom: '8px',
                      }}
                    >
                      {excerpt.source}
                    </div>
                    <div
                      style={{
                        fontSize: '16px',
                        lineHeight: 1.5,
                        marginBottom: '8px',
                      }}
                    >
                      {excerpt.text}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#8BA4C2',
                      }}
                    >
                      Saved: {excerpt.timestamp}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
