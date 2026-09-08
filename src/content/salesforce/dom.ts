import type { StepResult } from '../../shared/types';

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Certains composants Lightning exposent un shadow root ouvert (.shadowRoot),
// d'autres non : chrome.dom.openOrClosedShadowRoot couvre les deux mais peut
// renvoyer undefined sans erreur — d'où l'ordre : .shadowRoot d'abord.
export function shadowRootOf(el: Element): ShadowRoot | null {
  if (el.shadowRoot) return el.shadowRoot;
  try {
    return chrome.dom.openOrClosedShadowRoot(el as HTMLElement) ?? null;
  } catch {
    return null;
  }
}

/** querySelectorAll qui traverse tous les shadow roots (ouverts ou fermés). */
export function deepAll<T extends Element = Element>(sel: string, root: ParentNode = document): T[] {
  const out = Array.from(root.querySelectorAll<T>(sel));
  root.querySelectorAll('*').forEach((e) => {
    const sr = shadowRootOf(e);
    if (sr) out.push(...deepAll<T>(sel, sr));
  });
  return out;
}

export function deepFirst<T extends Element = Element>(sel: string, root: ParentNode = document): T | null {
  const direct = root.querySelector<T>(sel);
  if (direct) return direct;
  for (const e of root.querySelectorAll('*')) {
    const sr = shadowRootOf(e);
    if (sr) {
      const found = deepFirst<T>(sel, sr);
      if (found) return found;
    }
  }
  return null;
}

// Salesforce Console garde plusieurs fiches montées en même temps : une fiche en
// arrière-plan reste dans le DOM à taille nulle. On teste la taille rendue, pas
// la présence dans le viewport (un champ plus bas dans la page est bien rendu).
export function isRendered(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * Dernier candidat rendu. Ne renvoie JAMAIS un candidat invisible par défaut
 * (sinon on lit/écrit la mauvaise fiche), sauf `fallbackLast` explicite.
 */
export function visibleEl<T extends Element>(candidates: T[], fallbackLast = false): T | null {
  for (let i = candidates.length - 1; i >= 0; i--) if (isRendered(candidates[i])) return candidates[i];
  return fallbackLast && candidates.length ? candidates[candidates.length - 1] : null;
}

export async function waitFor<T>(fn: () => T | null | undefined | false, timeoutMs: number, intervalMs = 150): Promise<T | null> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const v = fn();
    if (v) return v;
    await sleep(intervalMs);
  }
  return null;
}

export function textOf(el: Element): string {
  return ((el as HTMLElement).innerText || el.textContent || '').trim();
}

/** Remplit un input/textarea comme un vrai utilisateur (setter natif + événements). */
export function setNativeValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Parent, en franchissant les frontières de shadow DOM. */
export function climbUp(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return (root as ShadowRoot).host ?? null;
}

export function labelledControlBy(match: (text: string) => boolean): { label: HTMLLabelElement; forId: string; control: Element | null } | null {
  const labels = deepAll<HTMLLabelElement>('label').filter((l) => match(textOf(l).replace(/^\*/, '').trim()));
  const label = visibleEl(labels);
  if (!label) return null;
  const forId = label.getAttribute('for') || '';
  const control = forId ? deepAll('#' + CSS.escape(forId))[0] ?? null : null;
  return { label, forId, control };
}

export const labelledControl = (labelText: string) => labelledControlBy((t) => t === labelText);

/** Zone de saisie (input/textarea) derrière un label, même enveloppée dans un composant Lightning. */
export function inputBehindLabel(match: (text: string) => boolean): HTMLInputElement | HTMLTextAreaElement | null {
  const lc = labelledControlBy(match);
  const el = lc?.control;
  if (!el) return null;
  const input = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el : deepAll('input, textarea', el)[0];
  return input && isRendered(input) ? (input as HTMLInputElement | HTMLTextAreaElement) : null;
}

/** Bouton "Enregistrer" visible et actif le plus proche d'un élément (en remontant, shadow DOM compris). */
export function saveButtonNear(el: Element, maxDepth = 8): HTMLButtonElement | null {
  let ancestor: Element | null = el;
  for (let depth = 0; depth < maxDepth && ancestor; depth++) {
    ancestor = climbUp(ancestor);
    if (!ancestor) break;
    const btns = deepAll<HTMLButtonElement>('button', ancestor).filter((b) => textOf(b) === 'Enregistrer' && isRendered(b) && !b.disabled);
    if (btns.length) return btns[btns.length - 1];
  }
  return null;
}

/** Valeur affichée d'un champ en lecture (bloc .slds-form-element). */
export function fieldValue(labelText: string): string | null {
  const labels = deepAll('.slds-form-element__label').filter((l) => textOf(l) === labelText);
  const lbl = visibleEl(labels);
  const ctrl = lbl?.closest('.slds-form-element')?.querySelector('.slds-form-element__control');
  if (!ctrl) return null;
  return textOf(ctrl).replace('Modifier ' + labelText, '').trim();
}

/** Ouvre une rubrique repliée (clic sur son titre — seulement s'il est cliquable, pour ne pas confondre avec un simple libellé). */
export function expandSection(name: string): boolean {
  const titles = deepAll('*').filter((el) => el.children.length === 0 && (el.textContent || '').trim() === name && !!el.closest('button,[role="button"]'));
  const target = visibleEl(titles);
  const btn = target?.closest('button,[role="button"]');
  if (!btn) return false;
  (btn as HTMLElement).click();
  return true;
}

/** Clique un onglet du bandeau d'actions (Lead, Commentaires internes…) via son attribut title. */
export async function clickTabByTitle(title: string): Promise<StepResult> {
  const holder = visibleEl(deepAll('[title]').filter((e) => (e.getAttribute('title') || '').trim() === title));
  if (!holder) return { ok: false, msg: `onglet introuvable : ${title}` };
  const clickable = holder.matches('a,button') ? holder : deepAll('a,button', holder)[0] || holder;
  (clickable as HTMLElement).click();
  return { ok: true, msg: `${title} ouvert` };
}

/**
 * Remplit le champ "Commentaires" (onglet Commentaires internes) et clique le
 * bouton Enregistrer le plus proche — pas n'importe quel "Enregistrer" de la page.
 */
export async function fillCommentAndSave(text: string, settleMs = 1200): Promise<StepResult> {
  const textarea = await waitFor(() => {
    const lc = labelledControl('Commentaires');
    const ta = lc?.control;
    return ta && isRendered(ta) ? (ta as HTMLTextAreaElement) : null;
  }, 4000);
  if (!textarea) return { ok: false, msg: 'champ Commentaires introuvable' };

  setNativeValue(textarea, text);

  const saveBtn = await waitFor(() => saveButtonNear(textarea), 3000);
  if (!saveBtn) return { ok: false, msg: 'bouton Enregistrer introuvable' };
  saveBtn.click();

  // Salesforce re-rend le bandeau pendant l'enregistrement : on attend que le
  // formulaire se vide (confirmation) avec une marge avant et après.
  await sleep(settleMs);
  await waitFor(() => textarea.value === '', 5000);
  await sleep(settleMs);
  return { ok: true, msg: 'commentaire enregistré' };
}
