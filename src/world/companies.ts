import DATA from "../../content/companies.json" with { type: "json" };

export type Company = (typeof DATA.companies)[number];
export type Interviewer = Company["interviewer"];

export const COMPANIES: Company[] = DATA.companies;
export const companyById = (id: string) => COMPANIES.find((c) => c.id === id);
