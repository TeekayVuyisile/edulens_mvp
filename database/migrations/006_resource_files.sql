-- Assessment resources are stored in the database instead of a public
-- uploads/ folder: files are only downloadable by signed-in staff of the class,
-- and they survive redeploys on hosts with a temporary disk. A resource is
-- either a file (file_data) or a link (resource_url). Safe to re-run.

ALTER TABLE assessment_resources
  ADD COLUMN IF NOT EXISTS file_data BYTEA,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS file_size INTEGER,
  ALTER COLUMN resource_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_resources_assessment ON assessment_resources (assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessments_class_term ON assessments (class_id, term_number);
