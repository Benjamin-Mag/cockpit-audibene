import type { AppData } from '../model';

/**
 * Fusion à trois entre la copie du navigateur, le cockpit.json du dossier et leur dernier état commun
 * (la « base » : ce que ce navigateur a écrit ou relu dans ce dossier la dernière fois). Sert quand plusieurs
 * Cockpit (deux navigateurs, version perso et version d'équipe) partagent le même fichier.
 *
 * Ce qui n'a changé que d'un côté depuis la base l'emporte — ajout, modification ou suppression. Si les deux
 * côtés ont changé la même chose, la copie la plus récente gagne. Les listes d'objets à `id` (modèles, textes,
 * situations, catégories) se fusionnent élément par élément ; les autres (phrases, ventes, fiches de paie)
 * par valeur : passer une vente de CAT 1 à CAT 2, c'est retirer l'une et ajouter l'autre, jamais garder les deux.
 */
type Json = unknown;

const objetSimple = (v: Json): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Écriture stable (clés triées) : deux copies identiques ne doivent pas différer par l'ordre de leurs champs. */
const canon = (v: Json): string =>
  JSON.stringify(v, (_k, x: Json) => (objetSimple(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x)) ?? 'undefined';
const egal = (a: Json, b: Json) => canon(a) === canon(b);

/** Clé de chaque élément : son `id` s'il en a un, sinon sa valeur ; un doublon exact garde son rang. */
function cles(liste: Json[]): string[] {
  const vus = new Map<string, number>();
  return liste.map((x) => {
    const k = objetSimple(x) && typeof x.id === 'string' ? `id:${x.id}` : `v:${canon(x)}`;
    const n = vus.get(k) ?? 0;
    vus.set(k, n + 1);
    return n ? `${k}#${n}` : k;
  });
}

function fusionListe(b: Json[], l: Json[], d: Json[], localGagne: boolean): Json[] {
  const kb = cles(b), kl = cles(l), kd = cles(d);
  const mb = new Map(kb.map((k, i) => [k, b[i]]));
  const ml = new Map(kl.map((k, i) => [k, l[i]]));
  const md = new Map(kd.map((k, i) => [k, d[i]]));
  const garde = new Map<string, Json>();
  for (const k of new Set([...kl, ...kd])) {
    const dansBase = mb.has(k);
    if (ml.has(k) && md.has(k)) garde.set(k, dansBase ? fusion3(mb.get(k), ml.get(k), md.get(k), localGagne) : localGagne ? ml.get(k) : md.get(k));
    // D'un seul côté : ajouté là, ou supprimé de l'autre côté — sauf s'il a été modifié entre-temps (rien ne se perd).
    else if (ml.has(k)) { if (!dansBase || !egal(ml.get(k), mb.get(k))) garde.set(k, ml.get(k)); }
    else if (!dansBase || !egal(md.get(k), mb.get(k))) garde.set(k, md.get(k));
  }
  // Ordre : celui du côté qui l'a changé (glisser-déposer) ; ce qui n'existe que de l'autre côté vient après.
  const ordreLocalInchange = egal(kl.filter((k) => mb.has(k) && md.has(k)), kb.filter((k) => ml.has(k) && md.has(k)));
  const [premier, second] = ordreLocalInchange ? [kd, kl] : [kl, kd];
  const ordre = [...premier.filter((k) => garde.has(k)), ...second.filter((k) => garde.has(k) && !premier.includes(k))];
  return ordre.map((k) => garde.get(k));
}

export function fusion3(b: Json, l: Json, d: Json, localGagne: boolean): Json {
  if (egal(l, b)) return d;
  if (egal(d, b)) return l;
  if (egal(l, d)) return l;
  if (Array.isArray(l) && Array.isArray(d)) return fusionListe(Array.isArray(b) ? b : [], l, d, localGagne);
  if (objetSimple(l) && objetSimple(d)) {
    const base = objetSimple(b) ? b : {};
    const out: Record<string, Json> = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(d)])) {
      const v = fusion3(base[k], l[k], d[k], localGagne);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return localGagne ? l : d;
}

/** Même contenu (la date de modification mise à part). */
export function memesDonnees(a: AppData, b: AppData): boolean {
  const { updatedAt: _a, ...x } = a;
  const { updatedAt: _b, ...y } = b;
  return egal(x, y);
}

export function fusionnerAvecBase(base: AppData, local: AppData, dossier: AppData): AppData {
  const { updatedAt: _b, ...b } = base;
  const { updatedAt: tl, ...l } = local;
  const { updatedAt: td, ...d } = dossier;
  const out = structuredClone(fusion3(b, l, d, (tl ?? 0) >= (td ?? 0))) as AppData;
  out.onboardingDone = local.onboardingDone || dossier.onboardingDone;
  out.updatedAt = Math.max(tl ?? 0, td ?? 0);
  return out;
}
