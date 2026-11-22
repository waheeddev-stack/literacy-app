// npm run reset — wipes all business data (keeps schema). Reference content re-seeds on next boot.
import '../src/config/env.js';
import { dbExec } from '../src/config/db.js';
import { runMigrations } from '../src/config/migrate.js';

await runMigrations();
const tables = ['newsletter_subscribers', 'challenge_logs', 'challenge_enrollments', 'announcements', 'attempt_answers', 'quiz_attempts', 'quiz_questions', 'quizzes', 'question_options', 'questions', 'practice_responses', 'practice_checkins', 'practice_items',
  'campus_audit_scores', 'campus_audits', 'audit_items', 'score_snapshots', 'action_cards', 'audit_logs', 'class_members', 'classes', 'users', 'institutions', 'topics', 'app_settings'];
for (const t of tables) await dbExec(`DELETE FROM ${t}`);
console.log('All data cleared. Start the server to re-create reference content and the Super Admin.');
process.exit(0);
