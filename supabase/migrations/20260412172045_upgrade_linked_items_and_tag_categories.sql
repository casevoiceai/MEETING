/*
  # Upgrade: Linked Items and Tag Categories

  1. Changes
    - Add `linked_project_id` to `vault_files` so files can be linked to a project
    - Add `linked_project_id` to `side_notes` so notes can be linked to a project (already has project_id, adding explicit link column for UI)
    - Add `category` to `tag_registry` for tag organization
    - Add `color` to `tag_registry` for tag visual identity
    - Add `session_summary`, `key_topics`, `mentors_involved`, `decisions_made`, `unresolved_items` to sessions table for rich session metadata
    - Add `linked_session_id` to `side_notes` (alias already exists as session_id, keeping consistent)

  2. Security
    - All new columns inherit existing RLS policies on their tables
*/

-- Add linked_project_id to vault_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'linked_project_id'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN linked_project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add category and color to tag_registry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tag_registry' AND column_name = 'category'
  ) THEN
    ALTER TABLE tag_registry ADD COLUMN category text DEFAULT 'General';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tag_registry' AND column_name = 'color'
  ) THEN
    ALTER TABLE tag_registry ADD COLUMN color text DEFAULT '#C9A84C';
  END IF;
END $$;

-- Add rich metadata columns to sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'session_summary'
  ) THEN
    ALTER TABLE sessions ADD COLUMN session_summary text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'key_topics'
  ) THEN
    ALTER TABLE sessions ADD COLUMN key_topics text[] DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'mentors_involved'
  ) THEN
    ALTER TABLE sessions ADD COLUMN mentors_involved text[] DEFAULT '{}';
  END IF;
END $$;

-- Add linked_session_id to vault_files for session linking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'linked_session_id'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN linked_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add file_type to vault_files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN file_type text DEFAULT 'note';
  END IF;
END $$;
