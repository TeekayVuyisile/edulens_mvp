-- Learners become plain records.
--
-- Learners never sign in (guardians will get their own portal later), but every
-- learner used to need a `users` row with a made-up email and the shared
-- password "learner123" just to hold their name. Names now live on `learners`,
-- and those placeholder accounts are removed. Safe to re-run.

ALTER TABLE learners
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
  -- The school's own admission / register number. Optional, unique per school.
  ADD COLUMN IF NOT EXISTS admission_number VARCHAR(50);

-- Copy names across while learners.user_id still exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'learners' AND column_name = 'user_id'
  ) THEN
    EXECUTE '
      UPDATE learners l
      SET first_name = COALESCE(l.first_name, u.first_name), last_name = COALESCE(l.last_name, u.last_name)
      FROM users u
      WHERE u.user_id = l.user_id';
  END IF;
END $$;

-- A learner without a user row should not exist, but must not block the migration.
UPDATE learners
SET first_name = COALESCE(first_name, 'Unnamed'), last_name = COALESCE(last_name, 'learner')
WHERE first_name IS NULL OR last_name IS NULL;

ALTER TABLE learners
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS learners_school_admission_number_key
  ON learners (school_id, LOWER(admission_number))
  WHERE admission_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learners_school_name ON learners (school_id, last_name, first_name);

-- This view read learner names from users; rebuild it on learners.
DROP VIEW IF EXISTS learner_performance_view;
CREATE VIEW learner_performance_view AS
SELECT
    l.learner_id,
    l.first_name || ' ' || l.last_name AS learner_name,
    c.class_id,
    c.class_name,
    c.grade_level,
    s.subject_name,
    t.topic_name,
    g.percentage,
    g.grade_letter,
    a.assessment_name,
    a.assessment_type,
    a.term_number,
    a.scheduled_date
FROM learners l
JOIN classes c ON l.current_class_id = c.class_id
JOIN grades g ON l.learner_id = g.learner_id
JOIN assessments a ON g.assessment_id = a.assessment_id
LEFT JOIN subjects s ON a.subject_id = s.subject_id
LEFT JOIN topics t ON a.topic_id = t.topic_id
WHERE l.academic_status = 'active';

-- Remove the placeholder accounts. Detach any log rows that point at them first.
UPDATE activity_logs SET user_id = NULL
WHERE user_id IN (SELECT user_id FROM users WHERE role = 'learner');
UPDATE bulk_import_logs SET imported_by = NULL
WHERE imported_by IN (SELECT user_id FROM users WHERE role = 'learner');

ALTER TABLE learners DROP COLUMN IF EXISTS user_id;
DELETE FROM users WHERE role = 'learner';

-- Class sizes were kept in classes.current_enrollment by a trigger that also
-- counted learners who had left. Sizes are now counted when they are read.
DROP TRIGGER IF EXISTS trg_update_class_enrollment ON learners;
DROP FUNCTION IF EXISTS update_class_enrollment();
ALTER TABLE classes DROP COLUMN IF EXISTS current_enrollment;

-- A class's "class teacher" was stored twice: classes.primary_teacher_id and the
-- is_primary flag on its assignment. Bring them into line (the assignment wins
-- when both exist); the app keeps them in step from now on.
INSERT INTO class_teacher_assignments (class_id, teacher_id, is_primary)
SELECT c.class_id, c.primary_teacher_id, true
FROM classes c
WHERE c.primary_teacher_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM class_teacher_assignments a WHERE a.class_id = c.class_id AND a.is_primary)
ON CONFLICT (class_id, teacher_id) DO UPDATE SET is_primary = true;

-- At most one class teacher per class: keep the earliest assigned.
UPDATE class_teacher_assignments a SET is_primary = false
WHERE a.is_primary AND EXISTS (
  SELECT 1 FROM class_teacher_assignments b
  WHERE b.class_id = a.class_id AND b.is_primary
    AND (b.assigned_at, b.assignment_id::text) < (a.assigned_at, a.assignment_id::text)
);

UPDATE classes c SET primary_teacher_id = (
  SELECT a.teacher_id FROM class_teacher_assignments a WHERE a.class_id = c.class_id AND a.is_primary
);
