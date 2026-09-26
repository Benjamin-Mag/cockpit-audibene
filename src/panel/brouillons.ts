// Brouillons de saisie par fiche Salesforce (COSI, Anamnèse, Mail, Chat partenaire) : on retrouve
// ses choix en revenant sur une fiche. Mémoire de session du navigateur (effacée à sa fermeture),
// jamais dans cockpit.json. Ménage automatique pour ne pas accumuler des fiches oubliées.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Fiche } from '../shared/types';

interface BrouillonFiche {
  /** Dernière fois que la fiche a été modifiée dans Cockpit ou vue ouverte dans un onglet. */
  vu: number;
  champs: Record<string, unknown>;
}
type Brouillons = Record<string, BrouillonFiche>;

const CLE = 'cockpitBrouillons';
/** Nombre de fiches gardées au plus (les plus anciennes partent). */
export const MAX_FICHES = 30;
/** Une fiche qui n'est plus ouverte dans aucun onglet depuis ce délai perd son brouillon. */
export const OUBLI_MS = 2 * 60 * 60 * 1000;
/** Aucun brouillon ne dépasse cette durée. */
export const DUREE_MAX_MS = 12 * 60 * 60 * 1000;
/** Fréquence de la vérification des onglets ouverts. */
export const VERIFICATION_MS = 5 * 60 * 1000;

let brouillons: Brouillons = {};
let chargement: Promise<void> | null = null;
let ecriture: ReturnType<typeof setTimeout> | undefined;

const memoireSession = () => (typeof chrome !== 'undefined' && chrome.storage?.session) || null;

/** Clé d'une vraie fiche (Piste ou Opportunité) : seules ces fiches ont un brouillon. */
export const ficheAvecBrouillon = (ficheKey: string) => /^(lead|opportunity):[A-Za-z0-9]{15,18}$/.test(ficheKey);

/** La fiche affichée est-elle bien celle du brouillon (et plus celle d'avant, ou en cours de lecture) ? */
export const ficheLue = (ficheKey: string, fiche: Fiche | null) => !ficheAvecBrouillon(ficheKey) || (!!fiche && ficheKey.endsWith(`:${fiche.recordId}`));

/** À appeler une fois au démarrage du panneau, avant d'afficher les onglets de saisie. */
export function chargerBrouillons(): Promise<void> {
  chargement ??= (async () => {
    try {
      const s = memoireSession();
      const lu = s ? (await s.get(CLE))[CLE] : JSON.parse(sessionStorage.getItem(CLE) || 'null');
      brouillons = lu && typeof lu === 'object' ? (lu as Brouillons) : {};
    } catch {
      brouillons = {};
    }
    if (elaguer(Date.now())) enregistrer();
  })();
  return chargement;
}

function enregistrer() {
  clearTimeout(ecriture);
  ecriture = setTimeout(() => {
    try {
      const s = memoireSession();
      if (s) void s.set({ [CLE]: brouillons }).catch(() => { /* mémoire de session indisponible */ });
      else sessionStorage.setItem(CLE, JSON.stringify(brouillons));
    } catch { /* stockage indisponible : le brouillon reste le temps de la session du panneau */ }
  }, 300);
}

/** Retire les brouillons trop vieux, puis les plus anciens au-delà de MAX_FICHES. Renvoie vrai si quelque chose a changé. */
function elaguer(maintenant: number): boolean {
  let change = false;
  for (const [cle, f] of Object.entries(brouillons)) {
    if (!f || typeof f.vu !== 'number' || maintenant - f.vu > DUREE_MAX_MS || !Object.keys(f.champs ?? {}).length) { delete brouillons[cle]; change = true; }
  }
  const cles = Object.keys(brouillons).sort((a, b) => brouillons[a].vu - brouillons[b].vu);
  while (cles.length > MAX_FICHES) { delete brouillons[cles.shift()!]; change = true; }
  return change;
}

/**
 * Ménage régulier : une fiche encore ouverte dans un onglet garde son brouillon ; une fiche absente
 * de tous les onglets depuis OUBLI_MS le perd. (Dans la console Salesforce, seul le sous-onglet
 * affiché apparaît dans l'adresse : d'où ce délai, plutôt qu'un effacement immédiat.)
 */
export async function verifierOngletsOuverts(maintenant = Date.now()): Promise<void> {
  await chargerBrouillons();
  let ouvertes = new Set<string>();
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    try {
      const tabs = await chrome.tabs.query({ url: ['*://*.force.com/*', '*://*.salesforce.com/*'] });
      ouvertes = new Set(tabs.flatMap((t) => {
        const m = (t.url ?? '').match(/\/lightning\/r\/(Lead|Opportunity)\/([A-Za-z0-9]{15,18})/i);
        return m ? [`${m[1].toLowerCase() === 'lead' ? 'lead' : 'opportunity'}:${m[2]}`] : [];
      }));
    } catch { /* onglets illisibles : on ne supprime que par ancienneté */ }
  }
  let change = false;
  for (const [cle, f] of Object.entries(brouillons)) {
    if (ouvertes.has(cle)) { f.vu = maintenant; change = true; }
    else if (maintenant - f.vu > OUBLI_MS) { delete brouillons[cle]; change = true; }
  }
  if (elaguer(maintenant) || change) enregistrer();
}

/** Efface les champs d'un écran pour une fiche (après une injection réussie dans Salesforce). */
export function effacerBrouillon(ficheKey: string, prefixe: string) {
  const f = brouillons[ficheKey];
  if (!f) return;
  for (const nom of Object.keys(f.champs)) if (nom.startsWith(prefixe)) delete f.champs[nom];
  if (!Object.keys(f.champs).length) delete brouillons[ficheKey];
  enregistrer();
}

/** Onglet Salesforce suivi : gardé en mémoire de session pour survivre au rechargement du panneau. */
const CLE_ONGLET = 'cockpitOngletSf';

export async function ongletSfGarde(): Promise<number | null> {
  try {
    const s = memoireSession();
    const lu = s ? (await s.get(CLE_ONGLET))[CLE_ONGLET] : JSON.parse(sessionStorage.getItem(CLE_ONGLET) || 'null');
    return typeof lu === 'number' ? lu : null;
  } catch {
    return null;
  }
}

export function setOngletSfGarde(id: number | null): void {
  try {
    const s = memoireSession();
    if (s) void s.set({ [CLE_ONGLET]: id }).catch(() => { /* mémoire de session indisponible */ });
    else sessionStorage.setItem(CLE_ONGLET, JSON.stringify(id));
  } catch { /* stockage indisponible */ }
}

/** Nom de champ réservé : la dernière fiche lue, gardée avec les brouillons (même ménage, même durée). */
const CHAMP_FICHE = '__fiche';
/** En dessous de ce délai, la fiche gardée est considérée à jour : pas de relecture de Salesforce. */
export const FICHE_FRAICHE_MS = 60 * 1000;

/**
 * Le navigateur recharge le panneau à chaque changement d'onglet : sans mémoire, la fiche
 * repartirait en « chargement… » à chaque fois. On garde la dernière lecture par fiche.
 */
export function ficheMemo(ficheKey: string): { fiche: Fiche; at: number } | null {
  if (!ficheAvecBrouillon(ficheKey)) return null;
  const garde = brouillons[ficheKey]?.champs?.[CHAMP_FICHE] as { fiche?: Fiche; at?: number } | undefined;
  return garde?.fiche && typeof garde.at === 'number' ? { fiche: garde.fiche, at: garde.at } : null;
}

export function setFicheMemo(ficheKey: string, fiche: Fiche, at = Date.now()) {
  if (!ficheAvecBrouillon(ficheKey)) return;
  const f = (brouillons[ficheKey] ??= { vu: at, champs: {} });
  f.vu = at;
  f.champs[CHAMP_FICHE] = { fiche, at };
  enregistrer();
}

/** Nombre de fiches ayant un brouillon (affichage, tests). */
export const nombreDeBrouillons = () => Object.keys(brouillons).length;

/**
 * Comme useState, mais la valeur est gardée pour la fiche et restaurée en revenant dessus.
 * La valeur de départ n'est jamais enregistrée : seul ce que l'utilisateur change l'est.
 */
export function useBrouillon<T>(ficheKey: string, nom: string, depart: T) {
  const actif = ficheAvecBrouillon(ficheKey);
  const [valeur, setValeur] = useState<T>(() => {
    const garde = actif ? brouillons[ficheKey]?.champs?.[nom] : undefined;
    return garde !== undefined ? (garde as T) : depart;
  });
  const departJson = useRef(JSON.stringify(depart));
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) { premier.current = false; return; }
    if (!actif) return;
    const maintenant = Date.now();
    const f = (brouillons[ficheKey] ??= { vu: maintenant, champs: {} });
    f.vu = maintenant;
    if (JSON.stringify(valeur) === departJson.current) delete f.champs[nom];
    else f.champs[nom] = valeur;
    elaguer(maintenant);
    enregistrer();
  }, [valeur]);
  return [valeur, setValeur] as const;
}

/**
 * Remet à zéro les retouches d'un texte généré quand ce texte change (autre modèle, autre genre…),
 * mais pas au premier affichage (brouillon restauré) ni pendant la lecture de la fiche.
 */
export function useRemiseSiChangement(texte: string, lue: boolean, remettre: () => void) {
  const avant = useRef<{ texte: string; lue: boolean } | null>(null);
  useEffect(() => {
    const p = avant.current;
    avant.current = { texte, lue };
    if (!p || p.texte === texte || !p.lue || !lue) return;
    remettre();
  }, [texte, lue]);
}
