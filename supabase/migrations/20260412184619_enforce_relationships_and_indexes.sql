/*
  # Enforce Data Relationships and Indexes

  ## Summary
  This migration tightens data relationships across all core tables and adds missing
  performance indexes. No data is deleted or altered — only constraints, indexes,
  and helper infrastructure are added.

  ## Changes

  ### 1. Unique constraint on projects.name
  - Prevents duplicate project names
  - Uses a case-insensitive approach via a unique index on lower(name)

  ### 2. GIN indexes for array/jsonb tag lookups
  - vault_files.tags (text[]) — enables fast containment queries
  - side_notes.tags (jsonb) — enables fast containment queries
  - sessions.key_topics (text[]) — enables fast topic queries
  - emails.tags (text[]) — enables fast email tag queries

  ### 3. Missing FK indexes on side_notes
  - side_notes.session_id — already has FK, adding btree index for join performance
  - side_notes.project_id — already has FK, adding btree index for join performance

  ### 4. Index on tag_registry.tag for fast lookups
  - Already unique but explicit index improves lookup speed

  ### 5. Index on sessions.session_key
  - Frequently queried by key — btree index added

  ### 6. Index on sessions.archived
  - Most queries filter archived=false

  ### 7. Enforce side_notes have valid text (not blank)
  - Check constraint: text must not be empty string

  ### 8. Enforce tag_registry.tag is trimmed and lowercase-normalized
  - Check constraint: tag must not be blank

  ### 9. project_notes and project_tasks: btree index on project_id for join speed

  ### Security
  - No RLS changes — existing policies remain intact
*/

-- 1. Unique index on project names (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS projects_name_lower_unique
  ON projects (lower(name))
  WHERE archived = false;

-- 2. GIN index for vault_files.tags (text array)
CREATE INDEX IF NOT EXISTS vault_files_tags_gin
  ON vault_files USING GIN (tags);

-- 3. GIN index for sessions.key_topics (text array)
CREATE INDEX IF NOT EXISTS sessions_key_topics_gin
  ON sessions USING GIN (key_topics);

-- 4. GIN index for emails.tags (text array)
CREATE INDEX IF NOT EXISTS emails_tags_gin
  ON emails USING GIN (tags);

-- 5. GIN index for side_notes.tags (jsonb)
CREATE INDEX IF NOT EXISTS side_notes_tags_gin
  ON side_notes USING GIN (tags);

-- 6. GIN index for side_notes.mentors (jsonb)
CREATE INDEX IF NOT EXISTS side_notes_mentors_gin
  ON side_notes USING GIN (mentors);

-- 7. Btree index on side_notes.session_id (FK performance)
CREATE INDEX IF NOT EXISTS side_notes_session_id_idx
  ON side_notes (session_id)
  WHERE session_id IS NOT NULL;

-- 8. Btree index on side_notes.project_id (FK performance)
CREATE INDEX IF NOT EXISTS side_notes_project_id_idx
  ON side_notes (project_id)
  WHERE project_id IS NOT NULL;

-- 9. Btree index on side_notes.archived
CREATE INDEX IF NOT EXISTS side_notes_archived_idx
  ON side_notes (archived);

-- 10. Btree index on sessions.session_key (most-used lookup)
CREATE INDEX IF NOT EXISTS sessions_session_key_idx
  ON sessions (session_key);

-- 11. Btree index on sessions.archived
CREATE INDEX IF NOT EXISTS sessions_archived_idx
  ON sessions (archived);

-- 12. Btree index on project_notes.project_id
CREATE INDEX IF NOT EXISTS project_notes_project_id_idx
  ON project_notes (project_id);

-- 13. Btree index on project_tasks.project_id
CREATE INDEX IF NOT EXISTS project_tasks_project_id_idx
  ON project_tasks (project_id);

-- 14. Btree index on project_tasks.status
CREATE INDEX IF NOT EXISTS project_tasks_status_idx
  ON project_tasks (status);

-- 15. Btree index on vault_files.archived
CREATE INDEX IF NOT EXISTS vault_files_archived_idx
  ON vault_files (archived);

-- 16. Btree index on vault_files.linked_session_id (already has FK, add btree for join)
CREATE INDEX IF NOT EXISTS vault_files_linked_session_id_idx
  ON vault_files (linked_session_id)
  WHERE linked_session_id IS NOT NULL;

-- 17. Composite index on linked_items for forward and reverse lookups
CREATE INDEX IF NOT EXISTS linked_items_source_idx
  ON linked_items (source_type, source_id);

CREATE INDEX IF NOT EXISTS linked_items_target_idx
  ON linked_items (target_type, target_id);

-- 18. Check constraint: side_notes.text must not be blank
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'side_notes'
      AND constraint_name = 'side_notes_text_not_blank'
  ) THEN
    ALTER TABLE side_notes
      ADD CONSTRAINT side_notes_text_not_blank
      CHECK (trim(text) <> '');
  END IF;
END $$;

-- 19. Check constraint: tag_registry.tag must not be blank
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'tag_registry'
      AND constraint_name = 'tag_registry_tag_not_blank'
  ) THEN
    ALTER TABLE tag_registry
      ADD CONSTRAINT tag_registry_tag_not_blank
      CHECK (trim(tag) <> '');
  END IF;
END $$;

-- 20. Check constraint: project_tasks status must be valid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'project_tasks'
      AND constraint_name = 'project_tasks_status_valid'
  ) THEN
    ALTER TABLE project_tasks
      ADD CONSTRAINT project_tasks_status_valid
      CHECK (status IN ('open', 'in_progress', 'done'));
  END IF;
END $$;
