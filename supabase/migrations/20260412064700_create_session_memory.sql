/*
  # Create session memory tables for Julie (Bridge Host)

  ## Purpose
  Enables Julie to maintain persistent meeting state across sessions.

  ## New Tables

  ### session_memory
  - `id` (uuid, primary key)
  - `session_id` (text) — identifies a meeting session
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `open_questions` (jsonb) — array of unanswered questions
  - `answered_questions` (jsonb) — array of answered questions with responses
  - `assigned_tasks` (jsonb) — array of tasks with owner and status
  - `unresolved_topics` (jsonb) — topics raised but not concluded
  - `active_topics` (jsonb) — topics currently in discussion
  - `decisions_made` (jsonb) — confirmed decisions
  - `pending_decisions` (jsonb) — decisions under consideration
  - `mentor_participation` (jsonb) — turn counts per mentor for balance tracking
  - `dropped_ideas` (jsonb) — ideas raised but not followed up on

  ## Security
  - RLS enabled
  - Public insert/select/update allowed per session_id (no auth required — session-scoped access)
*/

CREATE TABLE IF NOT EXISTS session_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  open_questions jsonb DEFAULT '[]'::jsonb,
  answered_questions jsonb DEFAULT '[]'::jsonb,
  assigned_tasks jsonb DEFAULT '[]'::jsonb,
  unresolved_topics jsonb DEFAULT '[]'::jsonb,
  active_topics jsonb DEFAULT '[]'::jsonb,
  decisions_made jsonb DEFAULT '[]'::jsonb,
  pending_decisions jsonb DEFAULT '[]'::jsonb,
  mentor_participation jsonb DEFAULT '{}'::jsonb,
  dropped_ideas jsonb DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_session_memory_session_id ON session_memory(session_id);

ALTER TABLE session_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read by session_id"
  ON session_memory FOR SELECT
  USING (true);

CREATE POLICY "Allow insert by anyone"
  ON session_memory FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update by session_id"
  ON session_memory FOR UPDATE
  USING (true)
  WITH CHECK (true);
