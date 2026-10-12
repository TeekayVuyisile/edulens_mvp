-- Learners placed in a class before placements were recorded have no
-- learner_class_history row for their current class, so their record says
-- "not placed yet". Open one for each, dated from their enrolment. Safe to re-run.

INSERT INTO learner_class_history (learner_id, class_id, academic_year, status, enrolled_date)
SELECT l.learner_id, l.current_class_id, c.academic_year, 'active',
       COALESCE(l.enrollment_date, l.created_at::date, CURRENT_DATE)
FROM learners l
JOIN classes c ON c.class_id = l.current_class_id
WHERE NOT EXISTS (
  SELECT 1 FROM learner_class_history h
  WHERE h.learner_id = l.learner_id AND h.class_id = l.current_class_id AND h.completed_date IS NULL
);
