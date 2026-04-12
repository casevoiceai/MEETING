/*
  # Create Vault Files and Folders System

  ## Summary
  Adds a full file management layer to the vault system.

  ## New Tables

  ### `vault_folders`
  - `id` (uuid, primary key)
  - `name` (text) — folder display name
  - `parent_id` (uuid, nullable) — self-referential for nested folders
  - `created_at` (timestamptz)

  ### `vault_files`
  - `id` (uuid, primary key)
  - `folder_id` (uuid, nullable) — FK to vault_folders
  - `name` (text) — file name
  - `content` (text) — rich text content
  - `summary` (text) — short summary field
  - `tags` (text[]) — array of tag labels
  - `archived` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Public read/insert/update/delete allowed (no auth required, matches existing pattern)
*/

CREATE TABLE IF NOT EXISTS vault_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  parent_id uuid REFERENCES vault_folders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vault_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read vault folders"
  ON vault_folders FOR SELECT
  USING (true);

CREATE POLICY "Public can insert vault folders"
  ON vault_folders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update vault folders"
  ON vault_folders FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete vault folders"
  ON vault_folders FOR DELETE
  USING (true);

CREATE TABLE IF NOT EXISTS vault_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES vault_folders(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Untitled',
  content text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vault_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read vault files"
  ON vault_files FOR SELECT
  USING (true);

CREATE POLICY "Public can insert vault files"
  ON vault_files FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update vault files"
  ON vault_files FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete vault files"
  ON vault_files FOR DELETE
  USING (true);
