import type { StepResult } from '../../shared/types';
import { climbUp, deepAll, isRendered, shadowRootOf, sleep, textOf, visibleEl, waitFor } from './dom';

/**
 * Liste à choix multiples d'une fiche en modification (« Le client est intéressé par ») : Lightning l'affiche en double
 * liste (`lightning-dual-listbox`) — « Disponible » à gauche, « Sélectionné » à droite, options role="option" qu'on
 * sélectionne (aria-selected) puis qu'on fait passer d'une liste à l'autre avec les flèches « Déplacer la sélection vers … ».
 * Le libellé du champ n'est pas un <label for> (c'est un titre de groupe) : labelledControl ne la trouve pas.
 * On déplace une valeur à la fois, en relisant la double liste après chaque clic (Lightning la redessine), puis on relit
 * « Sélectionné » à la fin pour dire exactement ce qui a pris.
 */

const norm = (s: string) => s.normalize('NFC').replace(/[’‘`]/g, "'").replace(/^\*\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
const nomDe = (el: Element) => [el.getAttribute('title'), el.getAttribute('aria-label'), textOf(el)].filter(Boolean).join(' ');

/** Recherche sous un élément, son propre shadow root compris (deepAll ne regarde que ses descendants). */
function sous<T extends Element = Element>(hote: Element, sel: string): T[] {
  const sr = shadowRootOf(hote);
  return [...deepAll<T>(sel, hote), ...(sr ? deepAll<T>(sel, sr) : [])];
}

/** Texte des éléments désignés par aria-labelledby, cherchés dans la même racine (document ou shadow root). */
function texteEtiquette(el: Element): string {
  const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean);
  const racine = el.getRootNode() as Document | ShadowRoot;
  const parId = ids.map((id) => racine.getElementById?.(id)).filter((x): x is HTMLElement => !!x).map(textOf).join(' ');
  return parId || el.getAttribute('aria-label') || '';
}

const LIBELLES = 'legend, label, .slds-form-element__legend, .slds-form-element__label';

/** Libellés possibles d'une double liste : titre de son groupe, puis libellés posés juste au-dessus d'elle (quelques niveaux). */
function libellesDe(hote: Element): string[] {
  const out = sous(hote, '[role="group"]').map(texteEtiquette);
  out.push(...sous(hote, LIBELLES).map(textOf));
  let a: Element | null = hote;
  for (let i = 0; i < 5 && a; i++) {
    a = climbUp(a);
    if (!a) break;
    const enfants = [...Array.from(a.children), ...Array.from(shadowRootOf(a)?.children ?? [])];
    out.push(...enfants.filter((e) => e.matches(LIBELLES)).map(textOf));
  }
  return out.map(norm).filter(Boolean);
}

/** Double liste visible du champ (une fiche gardée en arrière-plan par la console n'est jamais touchée). */
function trouverHote(libelle: string): Element | null {
  const cible = norm(libelle);
  const hotes = deepAll('lightning-dual-listbox');
  const candidats = hotes.length ? hotes : deepAll('.slds-dueling-list');
  return visibleEl(candidats.filter((h) => libellesDe(h).includes(cible)));
}

type Cote = 'dispo' | 'choisis';
interface Double { dispo: Element; choisis: Element; nomDispo: string; nomChoisis: string }

const RE_CHOISIS = /s[ée]lectionn|choisi|selected|chosen/i;
const RE_DISPO = /disponible|available/i;

function lireDouble(hote: Element): Double | null {
  const listes = sous(hote, '[role="listbox"]');
  if (listes.length < 2) return null;
  const noms = listes.map(texteEtiquette);
  let iC = noms.findIndex((n) => RE_CHOISIS.test(n));
  let iD = noms.findIndex((n, i) => i !== iC && RE_DISPO.test(n));
  if (iD < 0) iD = iC === 0 ? 1 : 0;
  if (iC < 0) iC = iD === 0 ? 1 : 0;
  return { dispo: listes[iD], choisis: listes[iC], nomDispo: noms[iD] || 'Disponible', nomChoisis: noms[iC] || 'Sélectionné' };
}

const options = (liste: Element) => sous<HTMLElement>(liste, '[role="option"]');
const texteOption = (o: Element) => o.querySelector('[title]')?.getAttribute('title') || textOf(o);
const textes = (liste: Element) => options(liste).map(texteOption);
const optionDe = (liste: Element, valeur: string) => options(liste).find((o) => norm(texteOption(o)) === norm(valeur)) ?? null;

/** Flèche « Déplacer la sélection vers <liste> » : par le nom de la liste visée, puis par l'icône, puis par l'ordre. */
function bouton(hote: Element, d: Double, vers: Cote): HTMLButtonElement | null {
  const btns = sous<HTMLButtonElement>(hote, 'button').filter((b) => isRendered(b) && !b.disabled && /d[ée]placer|move/i.test(nomDe(b)) && !/haut|bas|\bup\b|down|monter|descendre/i.test(nomDe(b)));
  const suffixe = (b: Element) => norm(nomDe(b).split(/\s(?:vers|to)\s/i).pop() ?? '');
  const nomVise = norm(vers === 'choisis' ? d.nomChoisis : d.nomDispo);
  const re = vers === 'choisis' ? RE_CHOISIS : RE_DISPO;
  const icone = vers === 'choisis' ? /#right$/ : /#left$/;
  return btns.find((b) => suffixe(b).startsWith(nomVise))
    ?? btns.find((b) => re.test(suffixe(b)))
    ?? btns.find((b) => Array.from(b.querySelectorAll('use')).some((u) => icone.test(u.getAttribute('href') || u.getAttribute('xlink:href') || '')))
    ?? (btns.length >= 2 ? btns[vers === 'choisis' ? 0 : 1] : null);
}

function cliquer(el: HTMLElement) {
  const init = { bubbles: true, composed: true, cancelable: true };
  el.dispatchEvent(new MouseEvent('mousedown', init));
  el.dispatchEvent(new MouseEvent('mouseup', init));
  el.dispatchEvent(new MouseEvent('click', init));
}

function appuyerEspace(el: HTMLElement) {
  el.focus();
  for (const type of ['keydown', 'keyup']) el.dispatchEvent(new KeyboardEvent(type, { key: ' ', code: 'Space', bubbles: true, composed: true, cancelable: true }));
}

/** Fait passer une valeur d'une liste à l'autre ; renvoie l'étape en échec, ou null si elle a bien changé de côté. */
async function deplacer(libelle: string, hote: Element, valeur: string, vers: Cote): Promise<StepResult | null> {
  const de: Cote = vers === 'choisis' ? 'dispo' : 'choisis';
  const lire = () => lireDouble(hote);
  const d0 = lire();
  if (!d0) return { ok: false, msg: `${libelle} : la double liste a disparu pendant le remplissage` };
  const nomSource = de === 'dispo' ? d0.nomDispo : d0.nomChoisis;
  const nomVers = vers === 'dispo' ? d0.nomDispo : d0.nomChoisis;
  const opt = optionDe(d0[de], valeur);
  if (!opt) return { ok: false, msg: `${libelle} : « ${valeur} » absent de « ${nomSource} »` };
  const selectionnee = () => { const d = lire(); const o = d && optionDe(d[de], valeur); return o?.getAttribute('aria-selected') === 'true' ? o : null; };
  cliquer(opt);
  let ok = await waitFor(selectionnee, 700, 50);
  if (!ok) {
    const dx = lire();
    const o = dx && optionDe(dx[de], valeur);
    if (o) appuyerEspace(o);
    ok = await waitFor(selectionnee, 700, 50);
  }
  if (!ok) return { ok: false, msg: `${libelle} : « ${valeur} » ne se sélectionne pas dans « ${nomSource} » (clic refusé par Salesforce ?) — à faire à la main` };
  const d1 = lire();
  const btn = d1 && bouton(hote, d1, vers);
  if (!btn) return { ok: false, msg: `${libelle} : bouton « Déplacer la sélection vers ${nomVers} » introuvable` };
  cliquer(btn);
  const arrivee = await waitFor(() => { const d = lire(); return d && optionDe(d[vers], valeur) && !optionDe(d[de], valeur) ? true : null; }, 1500, 50);
  if (!arrivee) return { ok: false, msg: `${libelle} : « ${valeur} » sélectionnée mais pas déplacée vers « ${nomVers} » (bouton sans effet)` };
  await sleep(120);
  return null;
}

/** Met exactement `voulues` dans « Sélectionné » : ajoute ce qui manque, retire le reste, puis relit. */
export async function remplirListeMultiple(libelle: string, voulues: string[]): Promise<StepResult[]> {
  let hote = await waitFor(() => trouverHote(libelle), 1500, 150);
  if (!hote) return [{ ok: false, msg: `liste « ${libelle} » introuvable — la fiche est-elle en modification (crayon) ?` }];
  const d = await waitFor(() => lireDouble(hote!), 1000, 100);
  if (!d) return [{ ok: false, msg: `${libelle} : listes « Disponible » / « Sélectionné » introuvables` }];

  const dispo = textes(d.dispo);
  const choisis = textes(d.choisis);
  const voulu = new Set(voulues.map(norm));
  const connu = new Set([...dispo, ...choisis].map(norm));
  const introuvables = voulues.filter((v) => !connu.has(norm(v)));
  const aAjouter = voulues.filter((v) => dispo.some((x) => norm(x) === norm(v)) && !choisis.some((x) => norm(x) === norm(v)));
  const aRetirer = choisis.filter((c) => !voulu.has(norm(c)));

  const steps: StepResult[] = introuvables.map((v) => ({ ok: false, msg: `${libelle} : option « ${v} » introuvable dans la liste de Salesforce` }));
  if (!aAjouter.length && !aRetirer.length) {
    if (!introuvables.length) steps.push({ ok: true, msg: `${libelle} déjà à jour (${choisis.join(', ') || 'rien'})` });
    return steps;
  }

  for (const [valeur, vers] of [...aAjouter.map((v) => [v, 'choisis'] as const), ...aRetirer.map((v) => [v, 'dispo'] as const)]) {
    if (!hote.isConnected) hote = trouverHote(libelle);
    if (!hote) { steps.push({ ok: false, msg: `${libelle} : la double liste a disparu pendant le remplissage` }); return steps; }
    const echec = await deplacer(libelle, hote, valeur, vers);
    if (echec) steps.push(echec);
  }

  const fin = hote.isConnected ? lireDouble(hote) : null;
  const final = fin ? textes(fin.choisis) : [];
  const attendus = voulues.filter((v) => connu.has(norm(v)));
  const manquent = attendus.filter((v) => !final.some((x) => norm(x) === norm(v)));
  const enTrop = final.filter((x) => !voulu.has(norm(x)));
  if (!fin) steps.push({ ok: false, msg: `${libelle} : impossible de relire « Sélectionné » à la fin` });
  else if (manquent.length || enTrop.length) steps.push({ ok: false, msg: `${libelle} : « ${fin.nomChoisis} » contient ${final.length ? final.join(', ') : 'rien'}${manquent.length ? ` — manque ${manquent.join(', ')}` : ''}${enTrop.length ? ` — en trop ${enTrop.join(', ')}` : ''}` });
  else steps.push({ ok: true, msg: `${libelle} → ${final.join(', ') || 'rien'}` });
  return steps;
}
