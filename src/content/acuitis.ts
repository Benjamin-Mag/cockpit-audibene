import type { ActionResult, PatientData } from '../shared/types';
import { fillById, fullName, listen, setVal } from './forms';

async function paste(data: PatientData, note: string): Promise<ActionResult> {
  const f = (id: string, v: string | undefined) => fillById(document, id, v);
  let found = false;
  found = f('name', data.nom) || found;
  found = f('firstname', data.prenom) || found;
  const tel = document.querySelector('input[type="tel"]');
  if (tel) { setVal(tel, data.telephone || ''); found = true; }
  found = f('email', data.email) || found;
  const parts = (data.naissance || '').split('/');
  let day = 'no', month = '', year = ''; // valeurs des options "Sélectionnez…"
  if (parts.length === 3) {
    day = String(parseInt(parts[0], 10));
    month = String(parseInt(parts[1], 10));
    year = parts[2];
  }
  found = f('birthdateDay', day) || found;
  found = f('birthdateMonth', month) || found;
  found = f('birthdateYear', year) || found;
  found = f('remarque', note) || found;
  if (!found) return { ok: false, msg: 'Aucun champ trouvé — ouvre le formulaire de RDV Acuitis' };
  return { ok: true, msg: `${fullName(data)} collé sur Acuitis` };
}

// Le widget de RDV (rdv.acuitis.com) est parfois dans une iframe d'une page
// fr.acuitis.com, parfois en page autonome : seule la frame rdv.acuitis.com
// répond au panneau.
export function initAcuitis() {
  if (!/(^|\.)rdv\.acuitis\.com$/i.test(location.hostname)) return;
  listen('acuitis', paste);
}
