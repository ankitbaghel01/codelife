// Types for the interview HTTP API. Mirrors docs/CONTRACTS.md §2–3 exactly; change the contract first.

export type PlayerProfile = {
  name: string;
  skills: { name: string; proficiency: number; source: "start" | "claimed" }[];
  resume: {
    summary: string;
    projects: { name: string; description: string }[];
  };
};

export type Speaker = "interviewer" | "player" | "system";
export type ChatMessage = {
  id: string;
  speaker: Speaker;
  text: string;
  at: string;
};

export type CodingTask = {
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

export type TestResult = {
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

export type RunResult = {
  ok: boolean;
  compileError: string | null;
  results: TestResult[];
  executor: "judge0" | "dev-subprocess";
  passed: number;
  total: number;
};

export type InterviewView = {
  id: string;
  companyId: string;
  roleId: string;
  interviewer: { name: string; title: string; gender: string };
  status: "in_progress" | "coding" | "completed";
  round: { index: number; total: number; name: string };
  question: { index: number; total: number; kind: string; mandatory: boolean };
  messages: ChatMessage[];
  coding: CodingTask | null;
  aiProvider: "claude" | "scripted";
};

export type QuestionReport = {
  kind: string;
  mandatory: boolean;
  prompt: string;
  answer: string | null;
  score: number | null;
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

export type Offer = {
  companyId: string;
  roleId: string;
  title: string;
  packageLpa: number;
  monthlySalary: number;
  workMode: string;
  joinInDays: number;
};

export type Evaluation = {
  decision: "selected" | "rejected";
  scores: { coding: number; concept: number; overall: number };
  thresholds: {
    minCodingPassRate: number;
    minConceptScore: number;
    minOverallScore: number;
  };
  reasons: string[];
  questions: QuestionReport[];
  revise: string[];
  offer: null | Offer;
};

export type Health = {
  ok: true;
  aiProvider: InterviewView["aiProvider"];
  executor: RunResult["executor"];
};

export type SubmitResponse = { result: RunResult; interview: InterviewView };
