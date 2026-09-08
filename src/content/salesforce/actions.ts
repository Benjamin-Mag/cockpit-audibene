import type { ActionResult, StepResult } from '../../shared/types';
import { clickTabByTitle, deepAll, deepFirst, fillCommentAndSave, isRendered, labelledControl, setNativeValue, sleep, textOf, visibleEl, waitFor } from './dom';

// ---------------------------------------------------------------- MV non joignable
async function clickPisteNonJoignable(): Promise<StepResult> {
  const find = () => visibleEl(deepAll<HTMLButtonElement>('button').filter((b) => textOf(b) === 'Piste non joignable' && !b.disabled));
  let btn = await waitFor(find, 2000);
  if (!btn) {
    // Le bouton n'existe que sur l'onglet "Lead" du bandeau, pas sur "Commentaires internes".
    await clickTabByTitle('Lead');
    btn = await waitFor(find, 3000);
  }
  if (!btn) return { ok: false, msg: 'bouton "Piste non joignable" introuvable' };
  btn.click();
  return { ok: true, msg: 'Piste non joignable cliqué' };
}

export async function runMv(comment: string): Promise<ActionResult> {
  const steps: StepResult[] = [];
  steps.push(await clickTabByTitle('Commentaires internes'));
  await sleep(400);
  steps.push(await fillCommentAndSave(comment));
  await sleep(400);
  steps.push(await clickTabByTitle('Lead'));
  await sleep(600);
  steps.push(await clickPisteNonJoignable());
  const failed = steps.filter((s) => !s.ok);
  return failed.length
    ? { ok: false, msg: 'Incomplet : ' + failed.map((s) => s.msg).join(' / '), steps }
    : { ok: true, msg: 'Piste marquée non joignable', steps };
}

// ---------------------------------------------------------------- Commentaire
export async function writeComment(text: string): Promise<ActionResult> {
  const steps: StepResult[] = [];
  steps.push(await clickTabByTitle('Commentaires internes'));
  await sleep(400);
  steps.push(await fillCommentAndSave(text));
  await sleep(300);
  steps.push(await clickTabByTitle('Lead'));
  const failed = steps.filter((s) => !s.ok);
  return failed.length
    ? { ok: false, msg: 'Incomplet : ' + failed.map((s) => s.msg).join(' / '), steps }
    : { ok: true, msg: 'Commentaire enregistré', steps };
}

// ---------------------------------------------------------------- Anamnèse
async function selectPicklist(labelText: string, valueText: string): Promise<StepResult> {
  const lc = labelledControl(labelText);
  if (!lc) return { ok: false, msg: `champ introuvable : ${labelText}` };
  const btn = lc.control as HTMLElement | null;
  if (!btn) return { ok: false, msg: `liste introuvable : ${labelText}` };
  if (btn.getAttribute('data-value') === valueText) return { ok: true, msg: `${labelText} déjà à ${valueText}` };
  btn.click();
  await sleep(250);
  for (let i = 0; i < 15; i++) {
    const opts = deepAll(`[id^="${lc.forId}-"]`).filter((o) => o.getAttribute('role') === 'option');
    const target = opts.find((o) => textOf(o) === valueText);
    if (target) {
      (target as HTMLElement).click();
      await sleep(150);
      return { ok: true, msg: `${labelText} → ${valueText}` };
    }
    await sleep(100);
  }
  return { ok: false, msg: `option "${valueText}" introuvable pour ${labelText}` };
}

async function fillTextInput(labelText: string, value: string): Promise<StepResult> {
  const lc = labelledControl(labelText);
  if (!lc) return { ok: false, msg: `champ introuvable : ${labelText}` };
  const el = lc.control;
  if (!el) return { ok: false, msg: `champ texte introuvable : ${labelText}` };
  const input = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el : deepAll('input, textarea', el)[0];
  if (!input) return { ok: false, msg: `zone de saisie introuvable : ${labelText}` };
  setNativeValue(input as HTMLInputElement, value);
  return { ok: true, msg: `${labelText} → texte rempli` };
}

export async function fillAnamnese(picklists: { label: string; value: string }[], texts: { label: string; value: string }[]): Promise<ActionResult> {
  const steps: StepResult[] = [];
  for (const p of picklists) steps.push(await selectPicklist(p.label, p.value));
  for (const t of texts) steps.push(await fillTextInput(t.label, t.value));
  const failed = steps.filter((s) => !s.ok);
  return failed.length
    ? { ok: false, msg: 'Incomplet : ' + failed.map((s) => s.msg).join(' / '), steps }
    : { ok: true, msg: `${steps.length} champ(s) rempli(s)`, steps };
}

// ---------------------------------------------------------------- Mail
export async function openComposer(): Promise<ActionResult> {
  if (visibleEl(deepAll('.ql-editor'))) return { ok: true, msg: 'composeur déjà ouvert' };
  const icon = deepAll('lightning-icon[data-tab-value][icon-name="utility:email"]').find(isRendered);
  if (!icon) return { ok: false, msg: 'bouton E-mail introuvable sur cette fiche' };
  (icon.closest('button,a,[role="button"]') || icon.parentElement || icon).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const ed = await waitFor(() => visibleEl(deepAll('.ql-editor')), 6000, 200);
  return ed ? { ok: true, msg: 'composeur ouvert' } : { ok: false, msg: 'le composeur ne s\'est pas ouvert' };
}

export async function insertMail(subject: string, html: string): Promise<ActionResult> {
  const opened = await openComposer();
  if (!opened.ok) return opened;
  const ed = visibleEl(deepAll<HTMLElement>('.ql-editor'));
  if (!ed) return { ok: false, msg: 'éditeur introuvable' };
  const si = deepFirst<HTMLInputElement>('input[placeholder="L\'objet"]');
  if (si && subject) {
    si.focus();
    setNativeValue(si, subject);
  }
  ed.focus();
  Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!.set!.call(ed, html);
  ed.dispatchEvent(new Event('input', { bubbles: true }));
  return { ok: true, msg: 'Mail inséré' };
}
