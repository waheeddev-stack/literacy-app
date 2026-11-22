CREATE TABLE IF NOT EXISTS challenge_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  card_id INTEGER NOT NULL,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','dropped'))
);
CREATE INDEX IF NOT EXISTS idx_ce_student ON challenge_enrollments (student_id, status);
CREATE TABLE IF NOT EXISTS challenge_logs (
  enrollment_id INTEGER NOT NULL,
  log_date DATE NOT NULL,
  PRIMARY KEY (enrollment_id, log_date)
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL,
  class_id INTEGER NULL,
  author_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ann_inst ON announcements (institution_id, created_at)
