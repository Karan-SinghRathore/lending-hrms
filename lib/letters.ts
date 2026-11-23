import { COMPANY_NAME } from "./config";
import { rupees } from "./format";

export type LetterData = {
  name: string;
  code: string;
  designation: string;
  department: string;
  branch: string;
  joinDate: string; // already formatted
  monthlyCtc: number;
  today: string; // already formatted
  signedBy: string;
};

const sign = (d: LetterData) => `\n\nFor ${COMPANY_NAME}\n\n\n${d.signedBy}\nHuman Resources`;

export const LETTERS: Record<string, { label: string; body: (d: LetterData) => string }> = {
  APPOINTMENT: {
    label: "Appointment letter",
    body: (d) =>
      `Date: ${d.today}\n\nTo,\n${d.name}\nEmployee code: ${d.code}\n\nSubject: Letter of appointment\n\nDear ${d.name},\n\nWe are pleased to appoint you as ${d.designation} in the ${d.department} department at our ${d.branch} branch, with effect from ${d.joinDate}.\n\nYour monthly cost to company will be ${rupees(d.monthlyCtc)}, subject to statutory deductions. Incentives, where applicable, are paid as per the company's incentive plan in force.\n\nYou will be on probation for six months from your date of joining. Your employment is governed by the company's HR policies as amended from time to time.\n\nWe welcome you to ${COMPANY_NAME} and wish you a long and successful career with us.${sign(d)}`,
  },
  CONFIRMATION: {
    label: "Confirmation letter",
    body: (d) =>
      `Date: ${d.today}\n\nTo,\n${d.name}\nEmployee code: ${d.code}\n\nSubject: Confirmation of employment\n\nDear ${d.name},\n\nFurther to your appointment on ${d.joinDate} and the successful completion of your probation, we are pleased to confirm your employment as ${d.designation} at our ${d.branch} branch.\n\nAll other terms and conditions of your appointment remain unchanged.\n\nWe appreciate your contribution and look forward to your continued association with ${COMPANY_NAME}.${sign(d)}`,
  },
  SALARY_CERTIFICATE: {
    label: "Salary certificate",
    body: (d) =>
      `Date: ${d.today}\n\nTO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that ${d.name} (employee code ${d.code}) is working with ${COMPANY_NAME} as ${d.designation} at our ${d.branch} branch since ${d.joinDate}.\n\nThe employee's current monthly cost to company is ${rupees(d.monthlyCtc)} (annual ${rupees(d.monthlyCtc * 12)}).\n\nThis certificate is issued at the request of the employee and carries no liability on the part of the company.${sign(d)}`,
  },
  EXPERIENCE: {
    label: "Experience letter",
    body: (d) =>
      `Date: ${d.today}\n\nTO WHOMSOEVER IT MAY CONCERN\n\nThis is to certify that ${d.name} (employee code ${d.code}) worked with ${COMPANY_NAME} as ${d.designation} in the ${d.department} department at our ${d.branch} branch from ${d.joinDate} to ${d.today}.\n\nDuring this period we found the employee to be sincere and hardworking. We wish them the very best in their future endeavours.${sign(d)}`,
  },
  RELIEVING: {
    label: "Relieving letter",
    body: (d) =>
      `Date: ${d.today}\n\nTo,\n${d.name}\nEmployee code: ${d.code}\n\nSubject: Relieving letter\n\nDear ${d.name},\n\nThis refers to your resignation from the post of ${d.designation} at our ${d.branch} branch. Your resignation has been accepted and you are relieved from the services of ${COMPANY_NAME} at the close of working hours on ${d.today}.\n\nWe confirm that you have handed over all company property and that your dues will be settled in the full and final settlement.\n\nWe thank you for your services and wish you success in your future career.${sign(d)}`,
  },
};
