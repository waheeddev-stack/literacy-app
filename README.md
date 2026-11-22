# Environmental Literacy and Sustainability Assessment Platform

Built from `Environmental_Literacy_Platform_PRD.pdf`, following the Jarvis 3.0 conventions: separate server and client
projects, dual-driver DB layer (SQLite for dev, TiDB Cloud for prod), zod validation, JWT auth, `config.json` runtime API URL.

```
env-literacy-server/   Node 22+ · Express · node:sqlite (dev) / mysql2 → TiDB Cloud (prod) · pdfkit
env-literacy-client/   React 18 · Vite · React Router · TanStack Query · Recharts · plain CSS tokens
```

## Run locally (no external services)

```bash
cd env-literacy-server
cp .env.example .env        # then set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD
npm install
npm run seed                # demo: 3 institutions, 42 students, quiz attempts, check-ins, audits
npm start                   # http://localhost:4100  (migrations + reference content run on boot)

cd ../env-literacy-client
npm install
npm run dev                 # http://localhost:5174  (proxies /api to :4100)
```

Demo logins after `npm run seed` (password `Demo@1234`, demo only):

| Role | Email |
|---|---|
| Super admin | admin@envliteracy.local |
| Regional admin | regional@envliteracy.local |
| Institution admin | admin.bvm@envliteracy.local |
| Teacher | teacher1.bvm@envliteracy.local |
| Student | student1.bvm@envliteracy.local |

`npm run reset` clears all data; the next boot re-creates the question bank, practice items, audit checklist,
action cards and the Super Admin from `.env`.

## TiDB Cloud (new database via script)

Jarvis 3.0's `.env` has no TiDB credentials filled in (it runs on SQLite), so there was nothing to reuse. Add yours to
`env-literacy-server/.env` (TiDB Cloud → your cluster → Connect):

```
TIDB_HOST=gateway01.<region>.prod.aws.tidbcloud.com
TIDB_PORT=4000
TIDB_USER=<prefix>.root
TIDB_PASSWORD=<password you set for the cluster>
TIDB_DATABASE=env_literacy     # a new database, separate from Jarvis's "tally"
TIDB_SSL=true
```

Then, once:

```bash
cd env-literacy-server
npm run db:tidb      # creates the database, applies migrations/*.tidb.sql, loads reference content, prints a health report
```

Finally set `DB_DRIVER=tidb` in `.env` and `npm start`. Add your IP in TiDB Cloud → Security if the connection is refused.
The SQLite twin migrations (`*.sqlite.sql`) are used for local dev. The TiDB path has not been run against a live cluster yet.

## Landing page

`/welcome` is the public landing page (biophilic moss theme: serif headlines, sage/cream palette, organic shapes, gentle fade-in and
parallax, reduced-motion respected). Logged-out visitors land there; Register and Log in lead into the app. The footer newsletter form
stores emails in `newsletter_subscribers`. Social links in the footer are placeholders; replace the `href`s in `src/pages/Landing.jsx`.

## What is implemented (PRD §5, §6)

- **Auth (FR-1/2):** register (student with institution + class code, teacher with approval, institution with Super Admin approval), login, refresh tokens, password reset, RBAC on every route, institution scoping.
- **Question bank (FR-3):** 48 starter questions across 8 topics and 5 grade bands; create, edit, activate/deactivate, CSV import with per-row errors.
- **Quizzes (FR-4/7):** auto-picked from topics and grade band, once per student, auto-scoring, per-topic breakdown, explanations after submission, retry on flaky connections.
- **Practice (FR-5):** weekly check-in (under a minute), streaks shown quietly, no leaderboards.
- **Gap engine (FR-6):** K, P, Gap, SI per topic and overall; classification; weights configurable by Super Admin; snapshots on demand and nightly (`score_snapshots`).
- **Dashboards (FR-9/10):** student, teacher (weakest topics, students needing support), institution (trend, grade comparison, audit), regional (ranking, heatmap, school vs college).
- **Campus audit (FR-8)**, **action cards (FR-12)**, **CSV/PDF export (FR-11)**, **audit log (FR-13)**.
- **Privacy:** groups under 5 students are hidden in aggregates; regional and institution reports are aggregate-only; guardian consent captured for school students.

## Extra features added after the PRD baseline

- **Eco-challenges** (students): 7-day habit challenges built from the action cards; log 5 of 7 days to complete. Personal only.
- **Badges** (students): 8 personal milestones, computed live, no rankings.
- **Practice mode** (students): unscored questions with instant feedback and explanations; never changes Knowledge scores.
- **Announcements** (teachers, institution admins): post to a class or the whole institution; shown on the student home.
- **Quiz results** (teachers, institution admins): completion, average, hardest questions, who has not taken it.
- **Participation metrics**: quiz and weekly check-in rates for classes and institutions (PRD success metrics), plus a "nudge these students" list.
- **Question item statistics** (content admins): % correct per question, flagged when too easy or too hard.
- **My account** (everyone): rename, change password, download my data as JSON.

## Decisions and assumptions to review

- **K** uses each student's latest 3 quiz attempts; **P** uses the last 4 weeks. Institution score is shown only when both student data and an audit exist.
- Academic terms: T1 Jun–Sep, T2 Oct–Jan, T3 Feb–May (e.g. `2026-27-T2`).
- No email service in v1: the password-reset code is returned by the API in development and only logged in production.
- Guardian-consent wording and the under-18 flow need legal review (DPDP Act), as the PRD notes.
- Starter questions should be reviewed by environmental educators before the pilot.
- Not built (PRD v2 / non-goals): AI tutor, multi-language content, parent view. The Jarvis chatbot is left for v2 per open question 5.
- Route handlers live in `src/routes/*` with logic in `src/services/*`; there is no separate `controllers/` layer.
