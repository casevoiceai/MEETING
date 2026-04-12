/*
  # Universal Linked Items Table

  ## Summary
  Creates a single polymorphic join table that allows any item type to be linked
  to any other item type. This powers the universal linking system across files,
  side notes, tags, sessions, and projects.

  ## New Tables
  - `linked_items`
    - `id` (uuid, primary key)
    - `source_type` (text) — "file" | "note" | "tag" | "session" | "project"
    - `source_id` (uuid) — ID of the source item
    - `target_type` (text) — "file" | "note" | "tag" | "session" | "project"
    - `target_id` (uuid) — ID of the target item
    - `created_at` (timestamptz)

  ## Constraints
  - Unique constraint on (source_type, source_id, target_type, target_id) to prevent duplicates
  - Links are bidirectional: querying either source or target returns the relationship

  ## Security
  - RLS enabled
  - Authenticated users can read, insert, and delete links (no sensitive data)

  ## Notes
  1. Links are stored once but queried in both directions (source→target and target→source)
  2. No foreign key constraints since items span multiple tables
  3. Deletion of a parent item should cascade via app logic or DB triggers
*/

CREATE TABLE IF NOT EXISTS linked_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE linked_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'linked_items_unique_pair'
  ) THEN
    ALTER TABLE linked_items
      ADD CONSTRAINT linked_items_unique_pair
      UNIQUE (source_type, source_id, target_type, target_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_linked_items_source ON linked_items (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_linked_items_target ON linked_items (target_type, target_id);

CREATE POLICY "Authenticated users can read linked items"
  ON linked_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert linked items"
  ON linked_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete linked items"
  ON linked_items FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anon users can read linked items"
  ON linked_items FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert linked items"
  ON linked_items FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can delete linked items"
  ON linked_items FOR DELETE
  TO anon
  USING (true);
