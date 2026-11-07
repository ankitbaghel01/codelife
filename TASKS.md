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

## Phase 2: career foundation (next)

- [ ] Backend: FastAPI + database (SQLite locally, Postgres in production), save service
- [ ] Study and practice on the laptop that raise proficiency through explicit rules
- [ ] Resume builder
- [ ] Fictional companies and roles, invitation rules, Jobs inbox
- [ ] Street and company office scene; reception and interview entry

## Phase 3: interview engine

- [ ] Interview sessions, rounds, text conversation, AI provider abstraction, typed outputs

## Phase 4: full-screen coding

- [ ] Monaco IDE that takes over the screen; Python Run (sample tests) in a Pyodide worker
- [ ] Submit with hidden tests via a sandbox (Judge0 on a Linux VM); clearly labelled dev adapter until then
- [ ] Server strips hidden tests and solutions before a problem reaches the browser

## Phase 5: hiring and career

- [ ] Hiring criteria per company, offer letter, salary and expenses

## Phase 6: polish

- [ ] Realistic art pass (glTF assets), sound, accessibility review, end-to-end tests
