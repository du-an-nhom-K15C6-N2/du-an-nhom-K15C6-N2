CREATE TABLE enrollment_history (
  class_id VARCHAR(255) NOT NULL,
  student_id VARCHAR(255) NOT NULL,
  enrolled_at TIMESTAMP NOT NULL,
  created_by VARCHAR(255) NOT NULL
);

CREATE INDEX enrollment_history_class_enrolled_at_idx
  ON enrollment_history (class_id, enrolled_at);

CREATE INDEX enrollment_history_student_enrolled_at_idx
  ON enrollment_history (student_id, enrolled_at);
