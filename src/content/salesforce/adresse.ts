/** Lieu du patient lu dans un texte d'adresse Salesforce : une ligne par partie (rue, « code postal ville », région, pays). */
export interface Lieu { rue: string; codePostal: string; ville: string }

/**
 * Code postal, ville et rue (tout ce qui précède le code postal, lignes réunies par des virgules) ; null sans code postal.
 * La rue n'a de sens que pour le champ « Adresse » : dans le titre d'une Opportunité, ce qui précède est le nom du patient.
 */
export function lireLieu(texte: string): Lieu | null {
  const t = texte || '';
  const m = t.match(/\b(\d{5})\s+([^\n]+)/);
  if (!m) return null;
  const ville = m[2].replace(/\s+-\s+\d{4}\/\d{2}.*$/, '').replace(/\s+(France)$/i, '').trim();
  const rue = t.slice(0, m.index).split('\n').map((l) => l.trim()).filter(Boolean).join(', ').replace(/[,\s]+$/, '');
  return { rue, codePostal: m[1], ville };
}
