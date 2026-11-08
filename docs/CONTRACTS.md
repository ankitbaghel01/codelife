# Contracts between workstreams (Phase 2–5)

Owners: **lead** = `src/App.tsx`, `src/game/state.ts`, `src/game/config.ts`, `src/ui/Phone.tsx`, `content/companies.json`, `vite.config.ts`, `package.json`.
**backend** = `server/`. **interview-ui** = `src/ui/interview/`, `src/api/`. **world** = `src/world/`.
Nobody edits another owner's files; ask the lead to change a contract.

## 1. Companies — `content/companies.json` (shared, public)

Read by both client and server. Each company: `id, name, tier, about, location, interviewer{name,title,gender,persona}, roles[]`.
Each role: `id, title, packageLpa, monthlySalary, workMode, requiredSkills[], minProficiency{skill:number}, rounds[], hiring{minCodingPassRate, minConceptScore, minOverallScore}`.
Round: `id, name, questions[]`; question: `{kind: "intro"|"resume"|"concept"|"coding"|"complexity"|"hr", mandatory, topic?, tier?}`.

## 2. Player profile sent to the server

```ts
type PlayerProfile = {
  name: string;
  skills: { name: string; proficiency: number; source: "start" | "claimed" }[];
  resume: {
    summary: string;
    projects: { name: string; description: string }[];
  };
};
```

## 3. HTTP API (FastAPI, `/api`, JSON). Vite proxies `/api` → `http://127.0.0.1:8000`.

All errors: HTTP 4xx/5xx with `{"detail": string}`.

```ts
type Speaker = "interviewer" | "player" | "system";
type ChatMessage = { id: string; speaker: Speaker; text: string; at: string }; // at = ISO time
type CodingTask = {
  // a problem WITHOUT hiddenTests or reference solution
  questionId: string;
  problemId: string;
  title: string;
  difficulty: string;
  statement: string;
  function: {
    name: string;
    params: { name: string; type: string }[];
    returns: string;
  };
  constraints: string[];
  examples: { args: unknown[]; expected: unknown; explanation?: string }[];
  starter: { python: string };
  visibleTests: { args: unknown[]; expected: unknown }[];
  limits: { timeMs: number; memoryMb: number };
};
type TestResult = {
  name: string;
  kind: "example" | "visible" | "hidden";
  passed: boolean;
  args: unknown[] | null;
  expected: unknown | null;
  got: unknown | null;
  error: string | null;
  stdout: string;
  timeMs: number;
};
type RunResult = {
  ok: boolean;
  compileError: string | null;
  results: TestResult[];
  executor: "judge0" | "dev-subprocess";
  passed: number;
  total: number;
};
type InterviewView = {
  id: string;
  companyId: string;
  roleId: string;
  interviewer: { name: string; title: string; gender: string };
  status: "in_progress" | "coding" | "completed";
  round: { index: number; total: number; name: string };
  question: { index: number; total: number; kind: string; mandatory: boolean };
  messages: ChatMessage[];
  coding: CodingTask | null; // set while a coding question is open
  aiProvider: "claude" | "scripted";
};
type QuestionReport = {
  kind: string;
  mandatory: boolean;
  prompt: string;
  answer: string | null;
  score: number | null; // 0..1, null = not scored
  feedback: string;
  coding?: {
    problemId: string;
    title: string;
    submitted: boolean;
    passed: number;
    total: number;
    code: string | null;
    referenceSolution: string | null;
    complexity: { time: string; space: string };
  };
};
type Evaluation = {
  decision: "selected" | "rejected";
  scores: { coding: number; concept: number; overall: number };
  thresholds: {
    minCodingPassRate: number;
    minConceptScore: number;
    minOverallScore: number;
  };
  reasons: string[]; // plain-English, e.g. "Coding: 6/9 hidden tests passed, needed 70%"
  questions: QuestionReport[];
  revise: string[]; // topics to practise
  offer: null | {
    companyId: string;
    roleId: string;
    title: string;
    packageLpa: number;
    monthlySalary: number;
    workMode: string;
    joinInDays: number;
  };
};
```

- `GET  /api/health` → `{ ok: true, aiProvider, executor }`
- `POST /api/interviews` body `{ playerId: string, companyId, roleId, profile: PlayerProfile }` → `InterviewView` (first interviewer message included)
- `GET  /api/interviews/{id}` → `InterviewView` (resume after refresh)
- `POST /api/interviews/{id}/answer` body `{ text }` → `InterviewView` (empty/whitespace text on a mandatory question → 422)
- `POST /api/interviews/{id}/run` body `{ questionId, code }` → `RunResult` (examples + visible tests only)
- `POST /api/interviews/{id}/submit` body `{ questionId, code }` → `{ result: RunResult, interview: InterviewView }` (all tests; hidden results carry no args/expected/got/stdout)
- `POST /api/interviews/{id}/finish` → `Evaluation` (409 if a mandatory question is unanswered; idempotent after completion)
- `GET  /api/interviews/{id}/report` → `Evaluation` (only when completed)

Rules: the AI only writes interviewer wording and conceptual rubric scores (validated and clamped 0..1). Code correctness comes only from the executor. The hiring decision is computed by code from `hiring` thresholds; the AI can't override it.

## 4. Client game state additions (lead, `src/game/state.ts`)

```ts
type Invitation = {
  id: string;
  companyId: string;
  roleId: string;
  day: number;
  time: number; // interview slot (game minutes)
  status: "pending" | "accepted" | "declined" | "expired" | "attended";
};
type Job = {
  companyId: string;
  roleId: string;
  title: string;
  monthlySalary: number;
  startDay: number;
};
// GameState gains: playerId, resume, invitations[], job|null, solved[], evidence[], interviewIds[]
```

## 5. Component props

- interview-ui exports `InterviewScreen({ invitation, profile, playerId, onDone, onExit })` from `src/ui/interview/InterviewScreen.tsx` — owns the conversation, the full-screen coding workstation, the result report and the offer letter; takes `playerId` and calls `onDone({ evaluation, accepted })` after the player accepts or declines the offer (or closes a rejection report).
- world exports `CityMap({ day, minute, invitations, job, onGo(placeId), onClose })` from `src/world/CityMap.tsx` (placeIds: `"home"`, `"company:<id>"`, `"library"`, `"cafe"`) and `<OfficeScene company interviewer onReady />` (an R3F scene for inside a `<Canvas>`, seated view across the interview desk) from `src/world/OfficeScene.tsx`.

## 6. Backend deltas (agreed after implementation)
1. Every `/api/interviews/{id}` call sends header `X-Player-Id` (missing → 422, other player → 403, unknown → 404).
2. After the last question: `question.kind = "done"`, `question.index = total`, `mandatory = false`; status stays `in_progress` until `/finish`.
3. `/answer` during a coding question stores the player's explanation; only Submit closes a coding question.
4. One final submit per coding question (second → 409). Run is unlimited. Actions after completion → 409.
5. Time limit / crash: every test is reported failed with the error string.
