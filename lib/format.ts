const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹ with Indian grouping: ₹12,45,000 */
export function rupees(n: number): string {
  return `₹${inr.format(Math.round(n))}`;
}

/** Compact ₹ in lakh / crore: ₹48.2 L, ₹1.35 Cr */
export function rupeesShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return rupees(n);
}

export function num(n: number): string {
  return inr.format(Math.round(n));
}

export function pct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
