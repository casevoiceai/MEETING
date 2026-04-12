/*
  # Enhance Julie Memory and Session Fields

  ## Summary
  Adds richer memory tracking fields to julie_reports and sessions tables.
  These fields enable full persistence of the Julie memory system including
  linked notes, linked files, linked decisions, and carryover resolution tracking.

  ## Changes

  ### julie_reports — new columns
  - `files_referenced` (jsonb) — array of {id, name, type} for files discussed
  - `notes_referenced` (jsonb) — array of {id, text, tags} for side notes created
  - `resolved_tasks` (jsonb) — tasks marked as resolved during session
  - `resolved_questions` (jsonb) — questions answered during session

  ### sessions — new columns
  - `decisions_made` (jsonb) — key decisions recorded
  - `unresolved_topics` (jsonb) — topics that need follow-up
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'julie_reports' AND column_name = 'files_referenced'
  ) THEN
    ALTER TABLE julie_reports ADD COLUMN files_referenced jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'julie_reports' AND column_name = 'notes_referenced'
  ) THEN
    ALTER TABLE julie_reports ADD COLUMN notes_referenced jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'julie_reports' AND column_name = 'resolved_tasks'
  ) THEN
    ALTER TABLE julie_reports ADD COLUMN resolved_tasks jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'julie_reports' AND column_name = 'resolved_questions'
  ) THEN
    ALTER TABLE julie_reports ADD COLUMN resolved_questions jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'decisions_made'
  ) THEN
    ALTER TABLE sessions ADD COLUMN decisions_made jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'unresolved_topics'
  ) THEN
    ALTER TABLE sessions ADD COLUMN unresolved_topics jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
