import { MONTHS_FR } from './dates';
import type { VentesData } from './model';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Clé de mois au format de l'ancien suivi : "Septembre 26". */
export function monthKey(d: Date): string {
  return `${cap(MONTHS_FR[d.getMonth()])} ${String(d.getFullYear()).slice(2)}`;
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = key.match(/^(\S+)\s+(\d{2})$/);
  if (!m) return null;
  const mi = MONTHS_FR.indexOf(m[1].toLowerCase());
  if (mi === -1) return null;
  return { year: 2000 + parseInt(m[2], 10), month: mi };
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

/** Tous les mois de janvier de la première année connue jusqu'au mois courant. */
export function listMonths(v: VentesData): string[] {
  const now = new Date();
  let startYear = now.getFullYear();
  for (const k of Object.keys(v.sales)) { const p = parseMonthKey(k); if (p && p.year < startYear) startYear = p.year; }
  const out: string[] = [];
  for (let y = startYear; y <= now.getFullYear(); y++) {
    const last = y === now.getFullYear() ? now.getMonth() : 11;
    for (let m = 0; m <= last; m++) out.push(monthKey(new Date(y, m, 1)));
  }
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
