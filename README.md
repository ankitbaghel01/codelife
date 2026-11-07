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

Click **New game**, type a name, then click the scene to look around.

| Key              | Action                                                              |
| ---------------- | ------------------------------------------------------------------- |
| W A S D / arrows | Walk                                                                |
| Mouse            | Look                                                                |
| E                | Use the object in front of you (bed, kitchen, mirror, laptop, door) |
| P                | Phone: messages, profile and skills, wallet                         |
| V                | Switch between first-person and third-person                        |
| Esc              | Pause                                                               |

## Checks

```bash
npm run check            # game rules: money, clock, skills, saves, collisions
npm run check:problems   # problem bank: runs every reference solution against every test
npm run build            # type check and production build
```

## What works and what doesn't yet

Working: menu, new game, the laptop with 40 practice problems in folders and a real Python editor (Run and Submit), the apartment in first-person and third-person, the mirror, the clock, energy and hunger, sleeping and eating, the phone with editable skills and a wallet, and saving in the browser.

Not built yet: the city, companies, job invitations and interviews (Phases 2–4). Java is not available yet. No backend, AI provider or code sandbox is set up, so no API keys are needed.
