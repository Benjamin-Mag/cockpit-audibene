import { MONTHS_FR } from './dates';
import type { VentesData } from './model';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Clé de mois au format de l'ancien suivi (version en ligne) : "Septembre 2026". */
export function monthKey(d: Date): string {
  return `${cap(MONTHS_FR[d.getMonth()])} ${d.getFullYear()}`;
}

/** Accepte "Janvier 2026" (format actuel) et "Janvier 26" (ancien format court). */
export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = key.trim().match(/^(.+?)\s+(\d{2}|\d{4})$/);
  if (!m) return null;
  const mi = MONTHS_FR.indexOf(m[1].toLowerCase());
  if (mi === -1) return null;
  const y = parseInt(m[2], 10);
  return { year: y < 100 ? 2000 + y : y, month: mi };
}

/** Clé normalisée ("Janvier 26" → "Janvier 2026") ; inchangée si non reconnue. */
export function canonicalMonthKey(key: string): string {
  const p = parseMonthKey(key);
  return p ? monthKey(new Date(p.year, p.month, 1)) : key;
}

export const monthLabel = (key: string) => {
  const p = parseMonthKey(key);
  return p ? `${cap(MONTHS_FR[p.month])} ${p.year}` : key;
};
const SHORT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
export const monthShort = (key: string) => {
  const p = parseMonthKey(key);
  return p ? SHORT[p.month] : key;
};

/** Années connues (ventes saisies) jusqu'à l'année courante. */
export function listYears(v: VentesData): number[] {
  const now = new Date().getFullYear();
  let start = now;
  for (const k of Object.keys(v.sales)) { const p = parseMonthKey(k); if (p && (v.sales[k]?.length ?? 0) > 0 && p.year < start) start = p.year; }
  const out: number[] = [];
  for (let y = start; y <= now; y++) out.push(y);
  return out;
}

/** Les mois d'une année, de janvier au mois courant (ou décembre pour une année passée). */
export function listMonths(year: number): string[] {
  const now = new Date();
  const last = year === now.getFullYear() ? now.getMonth() : 11;
  const out: string[] = [];
  for (let m = 0; m <= last; m++) out.push(monthKey(new Date(year, m, 1)));
  return out;
}

export const euro = (n: number) => (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
export const euro2 = (n: number) => (n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
export const pct = (n: number) => (n * 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';

export function computeRates(v: VentesData) {
  const s = v.settings;
  const pas = (s.tauxImposition ?? 9.9) / 100;
  const ps = v.payslips.filter((p) => p.includeInAverage !== false && p.brut > 0);
  if (!ps.length) return { cot: s.cotFallback, pas, retenues: s.retenuesFallback, fromPayslips: 0 };
  const cot = ps.reduce((a, p) => a + p.cotisations / p.brut, 0) / ps.length;
  const retenues = ps.reduce((a, p) => a + p.autresRetenues, 0) / ps.length;
  return { cot, pas, retenues, fromPayslips: ps.length };
}

export function computeSalary(v: VentesData, totalPrime: number) {
  const r = computeRates(v);
  const brut = v.settings.salaireBase + totalPrime;
  const netAvantImpot = brut * (1 - r.cot) + v.settings.indemnites - r.retenues;
  return { brut, netAvantImpot, netApresImpot: netAvantImpot * (1 - r.pas) };
}

export function computeMonth(v: VentesData, key: string) {
  const sales = v.sales[key] ?? [];
  const count1 = sales.filter((s) => s.cat === 1).length;
  const count2 = sales.filter((s) => s.cat === 2).length;
  const totalPrime = count1 * v.settings.primeCat1 + count2 * v.settings.primeCat2;
  return { count1, count2, total: count1 + count2, totalPrime, ...computeSalary(v, totalPrime) };
}
