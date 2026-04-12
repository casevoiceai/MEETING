/*
  # Upgrade Session Memory & Carryover System

  ## Summary
  Adds carryover tracking columns to the sessions and julie_reports tables so that
  unresolved items, tasks, questions and topics from a session can be automatically
  carried into the next session. Also adds columns for tracking files discussed
  and notes created during a session.

  ## Modified Tables

  ### sessions
  - `carryover_tasks` (jsonb) — tasks not completed that carry to next session
  - `carryover_questions` (jsonb) — open questions that carry to next session
  - `carryover_topics` (jsonb) — unresolved topics that carry to next session
  - `files_discussed` (text[]) — IDs of vault files discussed during session
  - `notes_created` (text[]) — IDs of side notes created during session
  - `participants` (text[]) — mentor names who participated

  ### julie_reports
  - `carryover_from_session` (text) — session key this report carried items from
  - `carryover_resolved` (jsonb) — items that were resolved vs carried forward

  ## Security
  - RLS already enabled on these tables from prior migrations
  - No new policy changes needed (existing policies cover new columns)

  ## Notes
  1. All new columns have safe defaults (empty array/null)
  2. Uses IF NOT EXISTS pattern to be idempotent
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'carryover_tasks'
  ) THEN
    ALTER TABLE sessions ADD COLUMN carryover_tasks jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'carryover_questions'
  ) THEN
    ALTER TABLE sessions ADD COLUMN carryover_questions jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'carryover_topics'
  ) THEN
    ALTER TABLE sessions ADD COLUMN carryover_topics jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'files_discussed'
  ) THEN
    ALTER TABLE sessions ADD COLUMN files_discussed text[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'notes_created'
  ) THEN
    ALTER TABLE sessions ADD COLUMN notes_created text[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'participants'
  ) THEN
    ALTER TABLE sessions ADD COLUMN participants text[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'julie_reports' AND column_name = 'carryover_from_session'
  ) THEN
    ALTER TABLE julie_reports ADD COLUMN carryover_from_session text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'julie_reports' AND column_name = 'carryover_resolved'
  ) THEN
    ALTER TABLE julie_reports ADD COLUMN carryover_resolved jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
