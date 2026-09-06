/**
 * All money in this codebase is an integer count of MINOR units
 * (paise, cents). Floats are never used for money — 0.1 + 0.2 problems
 * become customer refunds.
 */

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "INR";

const LOCALE_BY_CURRENCY: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

/** 1234567 paise -> "₹12,345.67" */
export function formatMoney(minor: number, currency: string = CURRENCY): string {
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency] ?? "en-US", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

/** "12.50" | 12.5 -> 1250 */
export function toMinor(major: number | string): number {
  const n = typeof major === "string" ? Number.parseFloat(major) : major;
  if (!Number.isFinite(n)) throw new Error(`Not a number: ${major}`);
  return Math.round(n * 100);
}

/** Percentage of a minor amount, rounded half-up. 1000 @ 5% -> 50 */
export function percentOfMinor(minor: number, percent: number | string): number {
  const p = typeof percent === "string" ? Number.parseFloat(percent) : percent;
  if (!Number.isFinite(p)) return 0;
  return Math.round((minor * p) / 100);
}
