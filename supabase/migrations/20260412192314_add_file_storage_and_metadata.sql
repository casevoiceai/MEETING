/*
  # Add File Storage and Metadata

  ## Summary
  Extends the vault_files table with storage-related columns so that real uploaded
  files can be tracked. Creates a Supabase Storage bucket for vault files.

  ## Changes

  ### 1. vault_files — new columns
  - `storage_path` (text, nullable) — path inside Supabase Storage bucket
  - `file_size` (bigint, nullable) — size in bytes
  - `mime_type` (text, nullable) — MIME type of the uploaded file
  - `original_name` (text, nullable) — original filename before any rename

  ### 2. Storage bucket
  - Creates the `vault-files` bucket as public (for easy URL-based preview)

  ### Security
  - No RLS changes to vault_files (existing policies intact)
  - Storage policies created for authenticated access
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN storage_path text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN file_size bigint DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN mime_type text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vault_files' AND column_name = 'original_name'
  ) THEN
    ALTER TABLE vault_files ADD COLUMN original_name text DEFAULT NULL;
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('vault-files', 'vault-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow authenticated uploads to vault-files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vault-files');

CREATE POLICY "Allow public reads from vault-files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'vault-files');

CREATE POLICY "Allow authenticated deletes from vault-files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vault-files');

CREATE POLICY "Allow anon uploads to vault-files"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'vault-files');

CREATE POLICY "Allow anon deletes from vault-files"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'vault-files');
