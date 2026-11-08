# CodeLife

A life simulation in the browser. You start as a jobless computer science graduate in a small rented flat, and you learn to code, pass job interviews by writing real code, earn a salary and build a better life. Everything in the game is fictional.

The full brief is in the PRD (`LIFE_exe_Game_PRD_and_Claude_Code_Prompt.md`). Progress is tracked in [TASKS.md](TASKS.md), and design choices are recorded in [DECISIONS.md](DECISIONS.md).

## Run it

You need Node 22.6 or newer and Python 3.11.

```bash
npm install
python scripts/fetch_assets.py   # only if public/assets is missing (needs: pip install pillow)
npm run dev            # open http://localhost:5173
```

Interviews need the backend (FastAPI) running in a second terminal:

```bash
pip install -r server/requirements.txt
npm run server         # http://127.0.0.1:8000, proxied by Vite at /api
```

Optional environment variables for the backend:

| Variable | Effect |
| --- | --- |
| `ANTHROPIC_API_KEY` | Use Claude as the interviewer (otherwise a scripted interviewer) |
| `CODELIFE_MODEL` | Claude model id (default `claude-haiku-5-5`) |
| `JUDGE0_URL`, `JUDGE0_KEY` | Run interview code in a Judge0 sandbox (otherwise a DEV-only local subprocess, not isolated) |

Click **New game**, type a name, then click the scene to look around.

| Key              | Action                                                              |
| ---------------- | ------------------------------------------------------------------- |
| W A S D / arrows | Walk                                                                |
| Mouse            | Look                                                                |
| E                | Use the object in front of you (bed, kitchen, mirror, laptop, door) |
| P                | Phone: messages, profile, skills and resume, wallet, jobs           |
| V                | Switch between first-person and third-person                        |
| Esc              | Pause                                                               |

## Checks

```bash
npm run check            # game rules: money, clock, skills, saves, collisions
npm run check:problems   # problem bank: runs every reference solution against every test
npm run build            # type check and production build
```

## What works and what doesn't yet

Working: the apartment (first- and third-person, mirror, sleep, eat), the phone (messages, profile, resume, wallet, job invitations), the laptop with 40 practice problems and a real Python editor, skill progress from practice, job invitations by explicit rules, the city map, company reception and interview room, AI-led or scripted interviews with a full-screen coding workstation, deterministic hiring, offer letters, a job with workdays, salary and rent, and saving in the browser.

Not yet: a real code sandbox (set up Judge0; the default executor is for development only), Java, the library and café, promotions. See [TASKS.md](TASKS.md).

```bash
npm run check          # game rules
npm run check:problems # practice + interview problem banks
npm run test:server    # backend: interviews, grading, hiring
```
