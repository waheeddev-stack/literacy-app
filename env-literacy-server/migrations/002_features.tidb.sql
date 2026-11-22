CREATE TABLE IF NOT EXISTS challenge_enrollments (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  student_id BIGINT NOT NULL,
  card_id INT NOT NULL,
  start_date DATE NOT NULL,
  status ENUM('active','done','dropped') NOT NULL DEFAULT 'active',
  INDEX idx_ce_student (student_id, status)
);
CREATE TABLE IF NOT EXISTS challenge_logs (
  enrollment_id BIGINT NOT NULL,
  log_date DATE NOT NULL,
  PRIMARY KEY (enrollment_id, log_date)
);
CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  institution_id BIGINT NOT NULL,
  class_id BIGINT NULL,
  author_id BIGINT NOT NULL,
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ann_inst (institution_id, created_at)
)
