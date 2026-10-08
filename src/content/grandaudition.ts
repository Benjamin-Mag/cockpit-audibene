import type { ActionResult, Genre, PatientData } from '../shared/types';
import { fullName, listen, remplirWidgetRdv, sleep } from './forms';

/** Civilité : deux boutons « M. » / « Mme » (précédés d'une lettre A / B dans le bouton). */
function cocherCivilite(genre: Genre): boolean {
  if (!genre) return false;
  const voulu = genre === 'F' ? 'Mme' : 'M.';
  const bouton = [...document.querySelectorAll('button')].find((b) => [...b.querySelectorAll('span')].some((s) => s.children.length === 0 && s.textContent?.trim() === voulu));
  bouton?.click();
  return !!bouton;
}

async function paste(data: PatientData, note: string): Promise<ActionResult> {
  // Même formulaire que celui d'Acuitis ; ici l'option « Jour » vaut une chaîne vide.
  const champs = remplirWidgetRdv(data, note, '');
  // Chaque bouton de civilité recopie l'état du formulaire tel qu'il était à son dernier affichage :
  // cliqué avant les champs, il était aussitôt écrasé par eux. On le clique donc en dernier.
  await sleep(300);
  const civilite = cocherCivilite(data.genre);
  if (!champs && !civilite) return { ok: false, msg: 'Aucun champ trouvé — avance jusqu\'au formulaire « vos coordonnées » de Grand Audition' };
  return { ok: true, msg: `${fullName(data)} collé sur Grand Audition` };
}

// Formulaire de RDV sur rendez-vous.grandaudition.com, en page autonome ou dans un cadre du site.
export function initGrandAudition(): () => void {
  if (!/(^|\.)rendez-vous\.grandaudition\.com$/i.test(location.hostname)) return () => {};
  return listen('grandaudition', paste);
}
