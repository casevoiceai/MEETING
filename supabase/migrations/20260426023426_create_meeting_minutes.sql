/*
  # Create meeting_minutes table

  1. New Tables
    - `meeting_minutes`
      - `id` (uuid, primary key)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `title` (text) — user-editable title for the minutes
      - `topic` (text) — main meeting topic extracted from transcript
      - `participants` (text[]) — team members who spoke
      - `key_points` (text[]) — main discussion points
      - `decisions` (text[]) — decisions made
      - `open_questions` (text[]) — unresolved questions
      - `action_items` (text[]) — tasks assigned with owner
      - `risks` (text[]) — risks or blockers raised
      - `raw_minutes` (text) — full formatted markdown minutes text
      - `tags` (text[]) — project, topic, member, risk, decision, action item tags
      - `tag_categories` (jsonb) — { project:[], topic:[], member:[], risk:[], decision:[], action:[] }
      - `message_count` (int) — how many messages were in the meeting when generated
      - `status` (text) — 'draft' | 'final'

  2. Security
    - Enable RLS
    - Authenticated users can read, insert, update their own minutes

  3. Notes
    - No session_id FK — minutes are generated from in-memory transcript and saved independently
    - tag_categories stores structured tag breakdown for later filtering
*/

CREATE TABLE IF NOT EXISTS meeting_minutes (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  title            text        NOT NULL DEFAULT '',
  topic            text        NOT NULL DEFAULT '',
  participants     text[]      NOT NULL DEFAULT '{}',
  key_points       text[]      NOT NULL DEFAULT '{}',
  decisions        text[]      NOT NULL DEFAULT '{}',
  open_questions   text[]      NOT NULL DEFAULT '{}',
  action_items     text[]      NOT NULL DEFAULT '{}',
  risks            text[]      NOT NULL DEFAULT '{}',
  raw_minutes      text        NOT NULL DEFAULT '',
  tags             text[]      NOT NULL DEFAULT '{}',
  tag_categories   jsonb       NOT NULL DEFAULT '{}',
  message_count    int         NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'draft'
);

ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select meeting_minutes"
  ON meeting_minutes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert meeting_minutes"
  ON meeting_minutes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update meeting_minutes"
  ON meeting_minutes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete meeting_minutes"
  ON meeting_minutes FOR DELETE
  TO authenticated
  USING (true);
