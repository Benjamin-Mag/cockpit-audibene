import type { ActionResult, PatientData } from '../shared/types';
import { REFERRER, fillById, fullName, listen, setVal, sleep } from './forms';

interface Ctx {
  doc: Document;
  win: Window;
  ids: { referrer: string; first_name: string; last_name: string; maiden_name: string; birthdate: string; place_of_birth_type: string; phone_number: string; email: string; message: string };
  genderF: string[];
  genderM: string[];
  genderNull: string[];
}

// Deux formulaires : la réservation en ligne (page elle-même) et le front-desk
// (formulaire dans l'iframe #agenda-iframe, même origine).
function getContext(): Ctx | null {
  if (/\/admin\/front-desk\//i.test(location.href)) {
    const iframe = document.getElementById('agenda-iframe') as HTMLIFrameElement | null;
    if (!iframe) return null;
    let doc: Document | null = null;
    let win: Window | null = null;
    try { doc = iframe.contentDocument; win = iframe.contentWindow; } catch { return null; }
    if (!doc || !win || !doc.getElementById('patient.first_name')) return null;
    return {
      doc, win,
      ids: { referrer: 'referrer', first_name: 'patient.first_name', last_name: 'patient.last_name', maiden_name: 'patient.maiden_name', birthdate: 'patient.birthdate', place_of_birth_type: 'patient.place_of_birth_type', phone_number: 'patient.phone_number', email: 'patient.email', message: 'notes' },
      // La civilité change selon le cabinet : "Civilité" (M./Mme) ou "Sexe biologique" (Homme/Femme).
      genderF: ['patient-gender-true', 'patient-biological_sex-female'],
      genderM: ['patient-gender-false', 'patient-biological_sex-male'],
      genderNull: ['patient-gender-null'],
    };
  }
  return {
    doc: document, win: window,
    ids: { referrer: 'referrer', first_name: 'first_name', last_name: 'last_name', maiden_name: 'maiden_name', birthdate: 'birthdate', place_of_birth_type: 'place_of_birth_type', phone_number: 'phone_number', email: 'email', message: 'referrer_message' },
    genderF: ['gender-true'], genderM: ['gender-false'], genderNull: [],
  };
}

async function selectLieuNaissanceInconnu(ctx: Ctx): Promise<boolean> {
  const trigger = ctx.doc.getElementById(ctx.ids.place_of_birth_type);
  if (!trigger) return false;
  trigger.click();
  for (let i = 0; i < 15; i++) {
    await sleep(100);
    const target = Array.from(ctx.doc.querySelectorAll<HTMLElement>('[role="option"]')).find((o) => (o.innerText || o.textContent || '').trim() === 'Lieu de naissance inconnu');
    if (target) { target.click(); return true; }
  }
  return false;
}

async function paste(data: PatientData, note: string): Promise<ActionResult> {
  const ctx = getContext();
  if (!ctx) return { ok: false, msg: 'Formulaire patient introuvable — ouvre le panneau de création de RDV' };
  const { doc, win, ids } = ctx;
  const f = (id: string, v: string | undefined) => fillById(doc, id, v, win);
  const genderIds = data.genre === 'F' ? ctx.genderF : data.genre === 'M' ? ctx.genderM : ctx.genderNull;
  let found = false;
  found = f(ids.referrer, REFERRER) || found;
  for (const id of genderIds) { const el = doc.getElementById(id); if (el) { el.click(); found = true; break; } }
  found = f(ids.first_name, data.prenom) || found;
  found = f(ids.last_name, data.nom) || found;
  found = f(ids.maiden_name, data.nom) || found;
  found = f(ids.birthdate, data.naissance) || found;
  found = (await selectLieuNaissanceInconnu(ctx)) || found;
  found = f(ids.phone_number, data.telephone) || found;
  found = f(ids.email, data.email) || found;
  found = f(ids.message, note) || found;
  if (!found) return { ok: false, msg: 'Aucun champ Doctolib trouvé sur cette page' };
  return { ok: true, msg: `${fullName(data)} collé sur Doctolib` };
}

export function initDoctolib(): () => void {
  if (window !== window.top) return () => {}; // le front-desk est atteint depuis la page parente
  return listen('doctolib', paste);
}

