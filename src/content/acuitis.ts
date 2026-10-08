import type { ActionResult, PatientData } from '../shared/types';
import { fullName, listen, remplirWidgetRdv } from './forms';

async function paste(data: PatientData, note: string): Promise<ActionResult> {
  // « no » : valeur de l'option « Sélectionnez… » du jour sur Acuitis.
  if (!remplirWidgetRdv(data, note, 'no')) return { ok: false, msg: 'Aucun champ trouvé — ouvre le formulaire de RDV Acuitis' };
  return { ok: true, msg: `${fullName(data)} collé sur Acuitis` };
}

// Le widget de RDV (rdv.acuitis.com) est parfois dans une iframe d'une page
// fr.acuitis.com, parfois en page autonome : seule la frame rdv.acuitis.com
// répond au panneau.
export function initAcuitis(): () => void {
  if (!/(^|\.)rdv\.acuitis\.com$/i.test(location.hostname)) return () => {};
  return listen('acuitis', paste);
}
