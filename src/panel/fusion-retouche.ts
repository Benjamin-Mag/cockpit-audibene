/**
 * Texte retouché à la main dans un aperçu, quand le texte généré change dessous (29/10/2026, Benjamin : « si je modifie
 * à la volée un template et une anamnèse, si j'ai oublié un champ (Monsieur ou Madame), le template de base se
 * réaffiche et on perd les modifications ») : le changement du modèle est reporté sur la retouche au lieu de l'effacer.
 * Fusion à trois mot à mot (comme un « diff3 ») entre l'ancien texte généré, le nouveau et la retouche : ce que seul le
 * modèle a changé (« patient(e) » → « patiente », un champ rempli) arrive dans la retouche ; ce que seul l'utilisateur
 * a changé reste ; un même passage changé des deux côtés garde la version de l'utilisateur. Pur.
 */

/** Mots (lettres et chiffres, apostrophes et traits d'union compris), blancs, puis chaque autre signe seul. */
const MORCEAUX = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|\s+|[^\p{L}\p{N}\s]/gu;
const morceaux = (t: string) => t.match(MORCEAUX) ?? [];

/** Correspondances d'une plus longue sous-suite commune : indice dans `a` → indice dans `b`. Début et fin communs à part. */
function correspondances(a: string[], b: string[]): Map<number, number> {
  const m = new Map<number, number>();
  let debut = 0;
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) { m.set(debut, debut); debut++; }
  let finA = a.length, finB = b.length;
  while (finA > debut && finB > debut && a[finA - 1] === b[finB - 1]) { finA--; finB--; m.set(finA, finB); }
  const n = finA - debut, p = finB - debut;
  if (!n || !p) return m;
  // Table des longueurs (du bas vers le haut), puis remontée.
  const L = new Uint32Array((n + 1) * (p + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = p - 1; j >= 0; j--) {
      L[i * (p + 1) + j] = a[debut + i] === b[debut + j] ? L[(i + 1) * (p + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (p + 1) + j], L[i * (p + 1) + j + 1]);
    }
  }
  let i = 0, j = 0;
  while (i < n && j < p) {
    if (a[debut + i] === b[debut + j]) { m.set(debut + i, debut + j); i++; j++; }
    else if (L[(i + 1) * (p + 1) + j] >= L[i * (p + 1) + j + 1]) i++;
    else j++;
  }
  return m;
}

const memes = (x: string[], y: string[]) => x.length === y.length && x.every((v, k) => v === y[k]);

/** Au-delà, la table serait trop lourde : la retouche reste telle quelle. */
const MAX_MORCEAUX = 4000;

/**
 * `avant` : texte généré sur lequel la retouche a été faite ; `apres` : le nouveau texte généré ; `retouche` : le texte
 * de l'utilisateur. Renvoie la retouche avec les changements du modèle reportés.
 */
export function fusionnerRetouche(avant: string, apres: string, retouche: string): string {
  if (avant === apres) return retouche;
  if (retouche === avant) return apres;
  const base = morceaux(avant), nouveau = morceaux(apres), sienne = morceaux(retouche);
  if (base.length > MAX_MORCEAUX || nouveau.length > MAX_MORCEAUX || sienne.length > MAX_MORCEAUX) return retouche;
  const versNouveau = correspondances(base, nouveau);
  const versSienne = correspondances(base, sienne);
  const sortie: string[] = [];
  let i = 0, n = 0, s = 0;
  for (;;) {
    // Prochain morceau de l'ancien texte resté en place des deux côtés : il borne le passage à fusionner.
    let k = i;
    while (k < base.length && !(versNouveau.has(k) && versSienne.has(k))) k++;
    const finN = k < base.length ? versNouveau.get(k)! : nouveau.length;
    const finS = k < base.length ? versSienne.get(k)! : sienne.length;
    const b = base.slice(i, k), nv = nouveau.slice(n, finN), sn = sienne.slice(s, finS);
    // Seul le modèle a changé ce passage : sa nouvelle version ; sinon celle de l'utilisateur (changée par lui, ou des deux côtés).
    sortie.push(...(memes(sn, b) ? nv : sn));
    if (k >= base.length) break;
    sortie.push(base[k]);
    i = k + 1; n = finN + 1; s = finS + 1;
  }
  return sortie.join('');
}
