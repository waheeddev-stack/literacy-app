-- SQLite twin of 001_init.tidb.sql (local development). ENUMs become CHECK constraints.
CREATE TABLE IF NOT EXISTS institutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('school','college')),
  board_or_university TEXT,
  ward_or_area TEXT,
  join_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','inst_admin','regional_admin','super_admin')),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  consent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_inst_role ON users (institution_id, role);
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  grade_band TEXT NOT NULL CHECK (grade_band IN ('6-8','9-10','11-12','undergrad','postgrad')),
  join_code TEXT UNIQUE NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_classes_inst ON classes (institution_id);
CREATE TABLE IF NOT EXISTS class_members (
  class_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  PRIMARY KEY (class_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_cm_student ON class_members (student_id);
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  grade_band TEXT NOT NULL CHECK (grade_band IN ('6-8','9-10','11-12','undergrad','postgrad')),
  difficulty INTEGER NOT NULL,
  text TEXT NOT NULL,
  explanation TEXT,
  is_active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_q_topic_grade ON questions (topic_id, grade_band);
CREATE TABLE IF NOT EXISTS question_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_opt_q ON question_options (question_id);
CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL,
  class_id INTEGER NULL,
  created_by INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('baseline','periodic','assigned')),
  opens_at DATETIME,
  closes_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_quiz_inst ON quizzes (institution_id);
CREATE TABLE IF NOT EXISTS quiz_questions (
  quiz_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  PRIMARY KEY (quiz_id, question_id)
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  score_pct DECIMAL(5,2),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (quiz_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_attempt_student ON quiz_attempts (student_id);
CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  option_id INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);
CREATE TABLE IF NOT EXISTS practice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  scale TEXT NOT NULL CHECK (scale IN ('yes_no','freq_0_4')),
  grade_band TEXT DEFAULT 'all'
);
CREATE TABLE IF NOT EXISTS practice_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  week_start DATE NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, week_start)
);
CREATE TABLE IF NOT EXISTS practice_responses (
  checkin_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (checkin_id, item_id)
);
CREATE TABLE IF NOT EXISTS audit_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  max_score INTEGER DEFAULT 5
);
CREATE TABLE IF NOT EXISTS campus_audits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL,
  term_label TEXT NOT NULL,
  submitted_by INTEGER NOT NULL,
  total_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (institution_id, term_label)
);
CREATE TABLE IF NOT EXISTS campus_audit_scores (
  audit_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  evidence_url TEXT,
  PRIMARY KEY (audit_id, item_id)
);
CREATE TABLE IF NOT EXISTS score_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL CHECK (scope IN ('student','class','institution','region')),
  scope_id INTEGER NOT NULL,
  topic_id INTEGER NULL,
  period_label TEXT NOT NULL,
  knowledge_score DECIMAL(5,2),
  practice_score DECIMAL(5,2),
  gap DECIMAL(5,2),
  sustainability_index DECIMAL(5,2),
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_snap ON score_snapshots (scope, scope_id, period_label);
CREATE TABLE IF NOT EXISTS action_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  gap_type TEXT NOT NULL CHECK (gap_type IN ('knowledge_heavy','practice_heavy','aligned')),
  title TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  entity TEXT,
  entity_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS app_settings (
  skey TEXT PRIMARY KEY,
  svalue TEXT NOT NULL
)
