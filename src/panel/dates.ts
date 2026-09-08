export const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export const isDateVar = (v: string) => /date/i.test(v);
export const isHeureVar = (v: string) => /heure/i.test(v);

/** '2026-09-12' → '12 septembre 2026' */
export function isoToFr(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${parseInt(m[3], 10)} ${MONTHS_FR[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

/** '12 septembre 2026' → '2026-09-12' (vide si non reconnu) */
export function frToIso(fr: string): string {
  const p = fr.trim().split(/\s+/);
  if (p.length !== 3) return '';
  const d = parseInt(p[0], 10), mi = MONTHS_FR.indexOf(p[1].toLowerCase()), y = parseInt(p[2], 10);
  if (isNaN(d) || mi === -1 || isNaN(y)) return '';
  return `${y}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** '14:00' → '14h00' */
export const timeToFr = (t: string) => (t.match(/^(\d{2}):(\d{2})/) ? t.slice(0, 2) + 'h' + t.slice(3, 5) : t);
/** '14h00' → '14:00' */
export const frToTime = (fr: string) => (fr.match(/^(\d{1,2})h(\d{2})$/) ? fr.replace('h', ':').padStart(5, '0') : '');

export function todayIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
