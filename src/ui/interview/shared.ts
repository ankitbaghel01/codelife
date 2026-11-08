/// <reference types="vite/client" />
// Small helpers shared by the interview screens: safe localStorage, company lookup, formatting.

type Company = {
  id: string;
  name: string;
  location: string;
  about: string;
  roles: { id: string; title: string }[];
};

const companyFiles = import.meta.glob("/content/companies.json", {
  import: "default",
  eager: true,
}) as Record<string, { companies: Company[] }>;
const COMPANIES = companyFiles["/content/companies.json"]?.companies ?? [];

export const company = (id: string) => COMPANIES.find((c) => c.id === id);

// localStorage can throw (private mode, blocked storage); the interview must still work without it.
export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const keys = {
  interview: (invitationId: string) => `codelife.interview.${invitationId}`,
  draft: (interviewId: string, questionId: string) =>
    `codelife.interview.draft.${interviewId}.${questionId}`,
  started: (interviewId: string, questionId: string) =>
    `codelife.interview.started.${interviewId}.${questionId}`,
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export const rupees = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export const elapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m % 60)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
};

export const kindLabel: Record<string, string> = {
  intro: "Introduction",
  resume: "Resume",
  concept: "Concept",
  coding: "Coding",
  complexity: "Complexity",
  hr: "HR",
};
