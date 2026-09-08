import type { ActionResult, StepResult } from '../../shared/types';
import { clickTabByTitle, climbUp, deepAll, deepFirst, expandSection, fillCommentAndSave, inputBehindLabel, isRendered, labelledControl, saveButtonNear, setNativeValue, sleep, textOf, visibleEl, waitFor } from './dom';

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
// Cible : la rubrique "Commentaire" en bas de la fiche, champ "Remarques générales
// profil client" (formulaire), et non le fil des commentaires internes.
const REMARQUES_LABEL = /^Remarques générales profil client/i;

export async function writeComment(text: string, save: boolean): Promise<ActionResult> {
  const find = () => inputBehindLabel((t) => REMARQUES_LABEL.test(t));
  let field = find();
  if (!field && expandSection('Commentaire')) {
    await sleep(500);
    field = await waitFor(find, 3000);
  }
  if (!field) return { ok: false, msg: 'champ « Remarques générales profil client » introuvable — la rubrique Commentaire est-elle sur cette page ?' };
  field.scrollIntoView({ block: 'center' });
  setNativeValue(field, text);
  if (!save) return { ok: true, msg: 'Écrit dans « Remarques générales profil client » — clique Enregistrer sur la fiche' };
  const btn = await waitFor(() => saveButtonNear(field!, 14), 3000);
  if (!btn) return { ok: true, msg: 'Écrit dans « Remarques générales profil client », mais bouton Enregistrer introuvable — enregistre à la main' };
  btn.click();
  await sleep(800);
  return { ok: true, msg: 'Écrit dans « Remarques générales profil client » et enregistré' };
}

// ---------------------------------------------------------------- Chat Partenaire (Opportunité)
// Onglet « Chat Partenaire » du bandeau d'actions : on l'ouvre, on repère la zone de
// saisie qui apparaît (celle du bandeau, pas une autre de la page), on écrit, on enregistre.
// C'est un fil Chatter : zone « Partager une mise à jour… » (simple zone de texte,
// qui devient un éditeur riche au focus) puis bouton « Envoyer un message (Chat) ».
export async function writeChatPartenaire(text: string): Promise<ActionResult> {
  let tab = await clickTabByTitle('Chat Partenaire');
  if (!tab.ok) {
    const el = visibleEl(deepAll<HTMLElement>('a, [role="tab"], button').filter((e) => textOf(e) === 'Chat Partenaire'));
    if (!el) return { ok: false, msg: 'onglet « Chat Partenaire » introuvable sur cette fiche' };
    el.click();
    tab = { ok: true, msg: 'Chat Partenaire ouvert' };
  }
  await sleep(500);

  const placeholderOf = (e: Element) => e.getAttribute('placeholder') || e.getAttribute('data-placeholder') || e.getAttribute('aria-placeholder') || e.getAttribute('aria-label') || '';
  const findBox = () => visibleEl(deepAll<HTMLElement>('textarea, [contenteditable="true"]').filter((e) => /partager une mise à jour/i.test(placeholderOf(e))));
  const box = await waitFor(findBox, 4000);
  if (!box) return { ok: false, msg: 'zone « Partager une mise à jour » introuvable' };

  box.focus();
  box.click();
  await sleep(500);

  // Après le focus, Salesforce peut avoir remplacé la zone par un éditeur riche (Quill) dans le même panneau.
  let editor: HTMLElement | null = null;
  let ancestor: Element | null = box;
  for (let depth = 0; depth < 10 && ancestor && !editor; depth++) {
    ancestor = climbUp(ancestor);
    if (ancestor) editor = visibleEl(deepAll<HTMLElement>('.ql-editor, [contenteditable="true"]', ancestor));
  }
  const target = editor && isRendered(editor) ? editor : box;
  if (target.tagName === 'TEXTAREA') {
    setNativeValue(target as HTMLTextAreaElement, text);
  } else {
    target.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, text);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await sleep(300);

  const sendBtn = await waitFor(() => {
    let a: Element | null = target;
    for (let depth = 0; depth < 12 && a; depth++) {
      a = climbUp(a);
      if (!a) break;
      const btns = deepAll<HTMLButtonElement>('button', a).filter((b) => /envoyer un message|partager/i.test(textOf(b)) && isRendered(b) && !b.disabled);
      if (btns.length) return btns[0];
    }
    return null;
  }, 3000);
  if (!sendBtn) return { ok: true, msg: 'Texte collé, mais le bouton « Envoyer un message » reste inactif — clique-le à la main' };
  sendBtn.click();
  await sleep(1000);
  return { ok: true, msg: 'Chat Partenaire : message envoyé' };
}

// ---------------------------------------------------------------- SMS (utilitaire Hearo)
const SMS_LABEL = /^(hearo|nouveau message|approbation en attente)/i;

/** Ouvre l'utilitaire Hearo de la barre du bas s'il ne l'est pas déjà ; renvoie les adresses des cadres du panneau. */
export async function openSmsPanel(): Promise<ActionResult> {
  const panelOpen = () => visibleEl(deepAll<HTMLElement>('.slds-utility-panel, [class*="utilityPanel"]').filter((p) => /hearo/i.test(textOf(p).slice(0, 200))));
  if (!panelOpen()) {
    const btn = visibleEl(deepAll<HTMLButtonElement>('button').filter((b) => SMS_LABEL.test(textOf(b))));
    if (!btn) return { ok: false, msg: 'bouton Hearo / Nouveau message introuvable dans la barre du bas' };
    btn.click();
    await waitFor(panelOpen, 4000, 200);
  }
  const panel = panelOpen();
  const frames = panel ? deepAll<HTMLIFrameElement>('iframe', panel).map((f) => f.src).filter(Boolean) : [];
  return { ok: true, msg: 'panneau SMS ouvert', steps: frames.map((src) => ({ ok: true, msg: src })) };
}

/** Relevé de ce que voit la page : cadres et leurs domaines, champs de recherche, utilitaires — pour cibler Hearo. */
export function diagSms(): ActionResult {
  const lines: string[] = [`page: ${location.hostname}${location.pathname.slice(0, 40)}`];
  const frames = deepAll<HTMLIFrameElement>('iframe');
  lines.push(`iframes: ${frames.length}`);
  for (const f of frames.slice(0, 12)) {
    let host = '(sans src)';
    try { host = f.src ? new URL(f.src).hostname + new URL(f.src).pathname.slice(0, 30) : f.srcdoc ? '(srcdoc)' : '(sans src)'; } catch { host = f.src.slice(0, 60); }
    lines.push(`  - ${isRendered(f) ? 'visible' : 'caché'} ${f.title ? `"${f.title}" ` : ''}${host}`);
  }
  // Une application Canvas est chargée par un formulaire POST vers son adresse : c'est là qu'on lit son domaine.
  const forms = deepAll<HTMLFormElement>('form').filter((f) => /^https?:/.test(f.getAttribute('action') || ''));
  lines.push(`formulaires vers l'extérieur: ${forms.map((f) => { try { return new URL(f.action).hostname + (f.target ? ` (cible ${f.target})` : ''); } catch { return f.action.slice(0, 50); } }).join(', ') || 'aucun'}`);
  const canvasFrames = deepAll<HTMLIFrameElement>('iframe').filter((f) => /canvas/i.test(f.title || '') || /canvas/i.test(f.name || ''));
  lines.push(`iframes canvas: ${canvasFrames.map((f) => `name="${f.name}" id="${f.id}"`).join(', ') || 'aucun'}`);
  const inputs = deepAll<HTMLInputElement>('input').filter((i) => /recherch|search/i.test(i.placeholder || i.getAttribute('aria-label') || ''));
  lines.push(`champs recherche (page principale): ${inputs.map((i) => `"${i.placeholder || i.getAttribute('aria-label')}"${isRendered(i) ? '' : ' (caché)'}`).join(', ') || 'aucun'}`);
  const utils = deepAll<HTMLButtonElement>('button').filter((b) => SMS_LABEL.test(textOf(b)));
  lines.push(`bouton utilitaire: ${utils.map((b) => `"${textOf(b).slice(0, 30)}"`).join(', ') || 'introuvable'}`);
  const panels = deepAll<HTMLElement>('[class*="utility"], [class*="Utility"]').filter((p) => isRendered(p) && p.getBoundingClientRect().height > 150);
  lines.push(`panneaux utilitaires visibles: ${panels.slice(0, 5).map((p) => `[${p.className.toString().slice(0, 40)}] ${textOf(p).slice(0, 60).replace(/\s+/g, ' ')}`).join(' | ') || 'aucun'}`);
  return { ok: true, msg: lines.join('\n') };
}

/** Tape le texte dans la « Recherche de client » (dans le document courant, quel que soit le cadre). */
export function fillSmsSearch(text: string): ActionResult | null {
  const input = visibleEl(deepAll<HTMLInputElement>('input').filter((i) => /recherche de client/i.test(i.placeholder || i.getAttribute('aria-label') || '')));
  if (!input) return null;
  input.focus();
  setNativeValue(input, text);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
  return { ok: true, msg: `SMS : recherche « ${text} »` };
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
