import { PAYROLL } from "./config";

export type PayLine = {
  workingDays: number;
  paidDays: number;
  lopDays: number;
  basic: number;
  hra: number;
  allowance: number;
  incentive: number;
  lopAmount: number;
  gross: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  net: number;
};

/** One person's pay for a month. All statutory figures are prototype assumptions (see PAYROLL in lib/config). */
export function computePay(monthlyCtc: number, workingDays: number, lopDays: number, incentive: number): PayLine {
  const basic = Math.round((monthlyCtc * PAYROLL.basicPct) / 100);
  const hra = Math.round((basic * PAYROLL.hraPctOfBasic) / 100);
  const allowance = monthlyCtc - basic - hra;
  const lopAmount = workingDays ? Math.round((monthlyCtc / workingDays) * lopDays) : 0;
  const gross = monthlyCtc - lopAmount + incentive;
  const paidShare = workingDays ? (workingDays - lopDays) / workingDays : 1;
  const pf = Math.round((Math.min(basic * paidShare, PAYROLL.pfWageCap) * PAYROLL.pfPct) / 100);
  const esi = monthlyCtc <= PAYROLL.esiGrossLimit ? Math.round((gross * PAYROLL.esiPct) / 100) : 0;
  const pt = gross > 0 ? PAYROLL.professionalTax : 0;
  const tds = gross > PAYROLL.tdsMonthlyThreshold ? Math.round(((gross - PAYROLL.tdsMonthlyThreshold) * PAYROLL.tdsPct) / 100) : 0;
  return {
    workingDays,
    paidDays: workingDays - lopDays,
    lopDays,
    basic,
    hra,
    allowance,
    incentive,
    lopAmount,
    gross,
    pf,
    esi,
    pt,
    tds,
    net: gross - pf - esi - pt - tds,
  };
}
