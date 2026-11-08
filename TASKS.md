# TASKS

Tracks the phases in the PRD (`LIFE_exe_Game_PRD_and_Claude_Code_Prompt.md`, section 27.4).

## Phase 0: assessment and plan (done)

- [x] Repo inspected (empty folder, no Docker, no Postgres, Node 24, Python 3.11)
- [x] Decisions recorded in DECISIONS.md
- [x] Problem bank: 10 T1 Python problems with visible and hidden tests (`content/problems/`), checked by `npm run check:problems`

## Phase 1: playable shell (done, verified in a browser)

- [x] Main menu: Continue, New game, Settings marked “coming later”
- [x] New game with name entry and validation
- [x] Starting state from `src/game/config.ts` (PRD section 5 values)
- [x] Apartment scene: first-person, collisions, golden-hour lighting (grey-box primitives)
- [x] Mirror: the only place you see yourself in first-person
- [x] V toggles a third-person camera that never clips through walls
- [x] HUD: day and clock, balance, energy and hunger meters, E prompts, subtitles
- [x] Daily actions: sleep (bed), cook a meal (kitchen, ₹120), clock and stat drift
- [x] Phone: messages, profile with editable name and skills, wallet ledger; Jobs tab marked “Phase 2”
- [x] Claimed skills start at 0 proficiency (integrity rule)
- [x] Save and load in localStorage, with save-shape validation
- [x] 14 rule checks (`npm run check`)

## Art, hero and laptop (done, verified in a browser)
- [x] Realistic room: CC0 Poly Haven furniture, textures and HDRI; iron bed; posters; AO, bloom and tone mapping
- [x] Realistic hero (Microsoft Rocketbox, MIT) with idle and walk animations; visible only in the mirror or in third-person
- [x] Laptop "ByteOS": Files app with Basics / Data Structures / Interview Prep folders (40 problems), Code IDE (Monaco)
- [x] Python Run and Submit in the browser (Pyodide worker + shared `content/harness.py`); Accepted / Wrong answer / errors; submission history

## Phase 2: career foundation (done, verified in a browser)
- [x] Practice raises proficiency through explicit rules (first accepted solution: DSA +2/4/6, Problem solving +half, Python +1 if listed), with evidence log
- [x] Resume builder (phone → Profile): summary + up to 5 projects, validated
- [x] Fictional companies and roles (`content/companies.json`, T1–T4), invitation rules (qualify by listed skills + measured proficiency, one per day, 7-day cooldown, missed interviews expire)
- [x] Jobs tab: invitation details, accept/decline
- [x] City map (front door) and company visit: travel time, reception check-in, office interview scene with a seated Rocketbox interviewer

## Phase 3: interview engine (done)
- [x] FastAPI backend (`server/`), SQLite persistence, resumable interviews
- [x] Rounds and questions from company config: intro, resume, concept, coding, complexity, HR; mandatory questions can't be skipped
- [x] AI provider abstraction: Claude (when `ANTHROPIC_API_KEY` is set) or a scripted interviewer; typed, validated outputs; fallback on errors

## Phase 4: full-screen coding interview (done)
- [x] Full-viewport workstation, Monaco, Run (visible tests) vs one final Submit (all tests)
- [x] Executor adapter: Judge0 (`JUDGE0_URL`) or a clearly labelled DEV subprocess executor
- [x] Hidden tests and solutions are server-only (separate `content/interview/` bank, blocked in the dev server, absent from the build); the sandbox receives inputs only and the server grades outputs

## Phase 5: hiring and career (done)
- [x] Deterministic hiring (coding pass rate, concept score, overall) per company thresholds; the AI can't override code results
- [x] Result report with reasons, code, reference solution, topics to revise; offer letter; accept/decline
- [x] Job, workdays (09:00–17:00 start, energy cost), pro-rated monthly salary, rent every 30 days

## Phase 6: polish (in progress)
- [x] HUD only in the apartment; workstation title readable at laptop widths
- [ ] Real sandbox: deploy Judge0 on a Linux VM (the dev executor is not isolated)
- [ ] Test with a real Claude API key
- [ ] Indian-looking characters and city view, newer laptop model, asset compression
- [ ] Library and café, more companies and roles, promotions
- [ ] Narrow-screen layouts, end-to-end test automation
