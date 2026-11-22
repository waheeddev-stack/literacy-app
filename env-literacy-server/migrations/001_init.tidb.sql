CREATE TABLE IF NOT EXISTS institutions (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type ENUM('school','college') NOT NULL,
  board_or_university VARCHAR(120),
  ward_or_area VARCHAR(120),
  join_code VARCHAR(12) UNIQUE NOT NULL,
  status ENUM('pending','active','suspended') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  institution_id BIGINT NULL,
  role ENUM('student','teacher','inst_admin','regional_admin','super_admin') NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  consent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_inst_role (institution_id, role)
);
CREATE TABLE IF NOT EXISTS classes (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  institution_id BIGINT NOT NULL,
  teacher_id BIGINT NOT NULL,
  name VARCHAR(100) NOT NULL,
  grade_band ENUM('6-8','9-10','11-12','undergrad','postgrad') NOT NULL,
  join_code VARCHAR(12) UNIQUE NOT NULL,
  INDEX idx_classes_inst (institution_id)
);
CREATE TABLE IF NOT EXISTS class_members (
  class_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  PRIMARY KEY (class_id, student_id),
  INDEX idx_cm_student (student_id)
);
CREATE TABLE IF NOT EXISTS topics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  topic_id INT NOT NULL,
  grade_band ENUM('6-8','9-10','11-12','undergrad','postgrad') NOT NULL,
  difficulty TINYINT NOT NULL,
  text TEXT NOT NULL,
  explanation TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  INDEX idx_q_topic_grade (topic_id, grade_band)
);
CREATE TABLE IF NOT EXISTS question_options (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  question_id BIGINT NOT NULL,
  text VARCHAR(500) NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX idx_opt_q (question_id)
);
CREATE TABLE IF NOT EXISTS quizzes (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  institution_id BIGINT NOT NULL,
  class_id BIGINT NULL,
  created_by BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL,
  type ENUM('baseline','periodic','assigned') NOT NULL,
  opens_at DATETIME,
  closes_at DATETIME,
  INDEX idx_quiz_inst (institution_id)
);
CREATE TABLE IF NOT EXISTS quiz_questions (
  quiz_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  PRIMARY KEY (quiz_id, question_id)
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  quiz_id BIGINT NOT NULL,
  student_id BIGINT NOT NULL,
  score_pct DECIMAL(5,2),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attempt (quiz_id, student_id)
);
CREATE TABLE IF NOT EXISTS attempt_answers (
  attempt_id BIGINT NOT NULL,
  question_id BIGINT NOT NULL,
  option_id BIGINT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);
CREATE TABLE IF NOT EXISTS practice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  topic_id INT NOT NULL,
  prompt VARCHAR(300) NOT NULL,
  scale ENUM('yes_no','freq_0_4') NOT NULL,
  grade_band VARCHAR(20) DEFAULT 'all'
);
CREATE TABLE IF NOT EXISTS practice_checkins (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  student_id BIGINT NOT NULL,
  week_start DATE NOT NULL,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_checkin (student_id, week_start)
);
CREATE TABLE IF NOT EXISTS practice_responses (
  checkin_id BIGINT NOT NULL,
  item_id INT NOT NULL,
  value TINYINT NOT NULL,
  PRIMARY KEY (checkin_id, item_id)
);
CREATE TABLE IF NOT EXISTS audit_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(80) NOT NULL,
  label VARCHAR(200) NOT NULL,
  max_score TINYINT DEFAULT 5
);
CREATE TABLE IF NOT EXISTS campus_audits (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  institution_id BIGINT NOT NULL,
  term_label VARCHAR(40) NOT NULL,
  submitted_by BIGINT NOT NULL,
  total_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_audit (institution_id, term_label)
);
CREATE TABLE IF NOT EXISTS campus_audit_scores (
  audit_id BIGINT NOT NULL,
  item_id INT NOT NULL,
  score TINYINT NOT NULL,
  evidence_url VARCHAR(500),
  PRIMARY KEY (audit_id, item_id)
);
CREATE TABLE IF NOT EXISTS score_snapshots (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  scope ENUM('student','class','institution','region') NOT NULL,
  scope_id BIGINT NOT NULL,
  topic_id INT NULL,
  period_label VARCHAR(20) NOT NULL,
  knowledge_score DECIMAL(5,2),
  practice_score DECIMAL(5,2),
  gap DECIMAL(5,2),
  sustainability_index DECIMAL(5,2),
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_snap (scope, scope_id, period_label)
);
CREATE TABLE IF NOT EXISTS action_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  topic_id INT NOT NULL,
  gap_type ENUM('knowledge_heavy','practice_heavy','aligned') NOT NULL,
  title VARCHAR(150) NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_RANDOM PRIMARY KEY,
  user_id BIGINT,
  action VARCHAR(80),
  entity VARCHAR(60),
  entity_id BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS app_settings (
  skey VARCHAR(80) PRIMARY KEY,
  svalue VARCHAR(500) NOT NULL
)
