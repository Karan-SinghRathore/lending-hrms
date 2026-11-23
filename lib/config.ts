// Change these two names before the demo — they show in the sidebar, page titles and exports.
export const PRODUCT_NAME = "PeopleDesk";
export const COMPANY_NAME = "Demo Finance Ltd";

export const LEAVE_TYPES = {
  CL: { label: "Casual Leave", short: "CL", annual: 8 },
  SL: { label: "Sick Leave", short: "SL", annual: 7 },
  EL: { label: "Earned Leave", short: "EL", annual: 15 },
} as const;
export type LeaveType = keyof typeof LEAVE_TYPES;

export const METRICS = {
  DISBURSAL: { label: "Disbursal", unit: "inr" },
  FILES: { label: "Files sanctioned", unit: "count" },
  COLLECTION: { label: "Collection", unit: "inr" },
  RESOLVED: { label: "Cases resolved", unit: "count" },
} as const;
export type Metric = keyof typeof METRICS;

export const PLANS = {
  SALES: { label: "Sales incentive plan", metrics: ["DISBURSAL", "FILES"] as Metric[] },
  COLLECTION: { label: "Collection incentive plan", metrics: ["COLLECTION", "RESOLVED"] as Metric[] },
} as const;
export type Plan = keyof typeof PLANS;

// Achievement above this is not counted further in the score (stops one huge case skewing payouts).
export const SCORE_CAP_PCT = 150;

// Office hours used for the "late" mark.
export const LATE_AFTER = { hour: 9, minute: 45 };

// Designation presets: picking one fills department and incentive plan.
export const DESIGNATIONS: Record<string, { department: string; plan: "SALES" | "COLLECTION" | "NONE"; accessRole: "HR" | "MANAGER" | "EMPLOYEE" }> = {
  "Relationship Officer": { department: "Sales", plan: "SALES", accessRole: "EMPLOYEE" },
  "Collection Officer": { department: "Collections", plan: "COLLECTION", accessRole: "EMPLOYEE" },
  "Credit Executive": { department: "Credit", plan: "NONE", accessRole: "EMPLOYEE" },
  "Operations Executive": { department: "Operations", plan: "NONE", accessRole: "EMPLOYEE" },
  "Branch Manager": { department: "Branch Management", plan: "NONE", accessRole: "MANAGER" },
  "HR Manager": { department: "Human Resources", plan: "NONE", accessRole: "HR" },
  "Accounts Executive": { department: "Accounts", plan: "NONE", accessRole: "EMPLOYEE" },
  "HR Executive": { department: "Human Resources", plan: "NONE", accessRole: "EMPLOYEE" },
};

export const METRIC_WEIGHT: Record<Metric, number> = { DISBURSAL: 70, FILES: 30, COLLECTION: 70, RESOLVED: 30 };

export const CHECKLISTS: Record<"JOINING" | "EXIT", { title: string; owner: "HR" | "MANAGER" | "EMPLOYEE" }[]> = {
  JOINING: [
    { title: "Signed offer letter received", owner: "HR" },
    { title: "Aadhaar and PAN copies submitted", owner: "EMPLOYEE" },
    { title: "Bank account details and cancelled cheque submitted", owner: "EMPLOYEE" },
    { title: "Previous employer relieving letter verified", owner: "HR" },
    { title: "PF / ESI nomination forms filled", owner: "EMPLOYEE" },
    { title: "ID card and visiting cards issued", owner: "HR" },
    { title: "Loan system login and mobile app access created", owner: "MANAGER" },
    { title: "Field kit handed over (tablet, receipt book)", owner: "MANAGER" },
    { title: "Product and compliance induction completed", owner: "MANAGER" },
  ],
  EXIT: [
    { title: "Resignation accepted and last working day confirmed", owner: "HR" },
    { title: "Open loan files and collection accounts handed over", owner: "MANAGER" },
    { title: "Cash and receipt book reconciled", owner: "MANAGER" },
    { title: "Tablet, ID card and SIM returned", owner: "EMPLOYEE" },
    { title: "System logins disabled", owner: "HR" },
    { title: "Full and final settlement calculated", owner: "HR" },
    { title: "Relieving and experience letters issued", owner: "HR" },
  ],
};

// Payroll assumptions for the prototype. Statutory rates must be confirmed with the client's CA before real use.
export const PAYROLL = {
  basicPct: 50, // of monthly CTC
  hraPctOfBasic: 40,
  pfPct: 12,
  pfWageCap: 15000,
  esiPct: 0.75,
  esiGrossLimit: 21000,
  professionalTax: 200,
  tdsMonthlyThreshold: 100000, // monthly gross above this
  tdsPct: 10, // on the amount above the threshold
};

export const RATINGS: Record<string, string> = {
  1: "1 · Needs improvement",
  2: "2 · Below expectations",
  3: "3 · Meets expectations",
  4: "4 · Exceeds expectations",
  5: "5 · Outstanding",
};

// Modules a role can be given. Order is the order in the sidebar and in the roles screen.
export const MODULES = {
  dashboard: "Dashboard",
  employees: "Employees",
  attendance: "Attendance",
  leave: "Leave",
  onboarding: "Onboarding & exit",
  recruitment: "Recruitment",
  documents: "Documents & letters",
  training: "Training",
  targets: "Targets",
  incentives: "Incentives",
  appraisals: "Appraisals",
  payroll: "Payroll",
  users: "Users & roles",
} as const;
export type ModuleKey = keyof typeof MODULES;

export const BASE_LABEL: Record<string, string> = {
  HR: "Whole company",
  MANAGER: "Own branch",
  EMPLOYEE: "Own records only",
};

export const CANDIDATE_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFERED", "HIRED", "REJECTED"] as const;
export const STAGE_LABEL: Record<string, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
};
export const CANDIDATE_SOURCES = ["Employee referral", "Walk-in", "Job portal", "Consultant", "Campus"];

export const DOCUMENT_KINDS = ["Aadhaar card", "PAN card", "Bank proof", "Photograph", "Education certificate", "Previous relieving letter", "Other"];
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const TRAINING_CATEGORIES = ["Induction", "Product", "Compliance", "Collections conduct", "Soft skills"];
