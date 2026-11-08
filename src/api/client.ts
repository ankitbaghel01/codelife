// Typed fetch wrappers for the interview API (docs/CONTRACTS.md §3).
// Every call sends X-Player-Id, times out after 30 s and throws ApiError(detail) on failure.
import type {
  Evaluation,
  Health,
  InterviewView,
  PlayerProfile,
  RunResult,
  SubmitResponse,
} from "./types";

export type * from "./types";

const TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached / timed out. */
  status: number;
  /** True when the interview server is down or unreachable (as opposed to rejecting the request). */
  offline: boolean;
  constructor(message: string, status: number, offline = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.offline = offline;
  }
}

export const OFFLINE_MESSAGE =
  "Can't reach the interview server. Start it with `npm run server`.";

async function request<T>(
  playerId: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        "X-Player-Id": playerId,
        ...(body !== undefined && { "Content-Type": "application/json" }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw ctrl.signal.aborted
      ? new ApiError(
          "The interview server took longer than 30 seconds to answer. Try again.",
          0,
        )
      : new ApiError(OFFLINE_MESSAGE, 0, true);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text().catch(() => "");
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body, handled below */
  }
  if (res.ok) return data as T;
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") throw new ApiError(detail, res.status);
  // FastAPI validation errors carry a list of {msg}.
  if (Array.isArray(detail))
    throw new ApiError(
      detail.map((d) => (d as { msg?: string }).msg ?? String(d)).join("; "),
      res.status,
    );
  // No JSON detail: the Vite proxy answers 500/502/504 with an empty body when the backend is down.
  if (res.status >= 500 && data === null)
    throw new ApiError(OFFLINE_MESSAGE, res.status, true);
  throw new ApiError(`Interview server error (${res.status}).`, res.status);
}

const id = (s: string) => encodeURIComponent(s);

export const getHealth = (playerId: string) =>
  request<Health>(playerId, "GET", "/health");

export const createInterview = (
  playerId: string,
  body: { companyId: string; roleId: string; profile: PlayerProfile },
) =>
  request<InterviewView>(playerId, "POST", "/interviews", {
    playerId,
    ...body,
  });

export const getInterview = (playerId: string, interviewId: string) =>
  request<InterviewView>(playerId, "GET", `/interviews/${id(interviewId)}`);

export const answer = (playerId: string, interviewId: string, text: string) =>
  request<InterviewView>(
    playerId,
    "POST",
    `/interviews/${id(interviewId)}/answer`,
    { text },
  );

export const runCode = (
  playerId: string,
  interviewId: string,
  questionId: string,
  code: string,
) =>
  request<RunResult>(playerId, "POST", `/interviews/${id(interviewId)}/run`, {
    questionId,
    code,
  });

export const submitCode = (
  playerId: string,
  interviewId: string,
  questionId: string,
  code: string,
) =>
  request<SubmitResponse>(
    playerId,
    "POST",
    `/interviews/${id(interviewId)}/submit`,
    { questionId, code },
  );

export const finishInterview = (playerId: string, interviewId: string) =>
  request<Evaluation>(
    playerId,
    "POST",
    `/interviews/${id(interviewId)}/finish`,
  );

export const getReport = (playerId: string, interviewId: string) =>
  request<Evaluation>(playerId, "GET", `/interviews/${id(interviewId)}/report`);
