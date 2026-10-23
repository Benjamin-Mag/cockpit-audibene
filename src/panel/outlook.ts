import { isExtension, writeClipboard } from './bridge';

/** Outlook dans le navigateur (Microsoft 365) : adresses possibles de la messagerie. */
const OUTLOOK = ['https://outlook.cloud.microsoft/*', 'https://outlook.office.com/*', 'https://outlook.office365.com/*'];
const ACCUEIL = 'https://outlook.cloud.microsoft/mail/';

/** Exécutée dans l'onglet Outlook : tape le texte dans « Rechercher » et lance la recherche (Entrée). */
async function taperRecherche({ recherche }: { recherche: string }): Promise<{ ok: boolean }> {
  const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let champ: HTMLInputElement | null = null;
  for (let i = 0; i < 80 && !champ; i++) {
    champ = document.querySelector<HTMLInputElement>('#topSearchInput, input[role="combobox"][placeholder="Rechercher"]');
    if (!champ) await attendre(250);
  }
  if (!champ) return { ok: false };
  champ.focus();
  champ.click();
  await attendre(200);
  champ.select();
  if (!document.execCommand('insertText', false, recherche) || champ.value !== recherche) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, recherche);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await attendre(200);
  for (const type of ['keydown', 'keypress', 'keyup']) champ.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
  return { ok: champ.value === recherche };
}

/**
 * Cherche le patient dans Outlook (icône enveloppe à côté de la roue, v1.1.14 ; d'abord dans Cockpit Benjamin). Le nom est d'abord copié (Outlook de bureau : Ctrl+E puis Ctrl+V),
 * puis l'onglet Outlook web est affiché — ou ouvert — et la recherche y est tapée et lancée.
 */
export async function chercherDansOutlook(nom: string): Promise<{ ok: boolean; msg: string }> {
  const copie = await writeClipboard(nom);
  const repli = { ok: false, msg: copie ? `${nom} copié — colle-le dans la recherche d'Outlook (Ctrl+E puis Ctrl+V)` : 'Copie impossible' };
  if (!isExtension) return repli;
  try {
    // Autorisation d'agir sur Outlook web : demandée une seule fois, au premier clic.
    if (!(await chrome.permissions.contains({ origins: OUTLOOK })) && !(await chrome.permissions.request({ origins: OUTLOOK }))) return repli;
    let [onglet] = await chrome.tabs.query({ url: OUTLOOK });
    if (onglet?.id != null) {
      await chrome.tabs.update(onglet.id, { active: true });
      if (onglet.windowId !== undefined) await chrome.windows.update(onglet.windowId, { focused: true }).catch(() => undefined);
    } else {
      onglet = await chrome.tabs.create({ url: ACCUEIL, active: true });
    }
    const id = onglet.id!;
    for (let i = 0; i < 80 && (await chrome.tabs.get(id)).status !== 'complete'; i++) await new Promise((r) => setTimeout(r, 250));
    const [res] = await chrome.scripting.executeScript({ target: { tabId: id }, world: 'MAIN', func: taperRecherche, args: [{ recherche: nom }] });
    return (res?.result as { ok: boolean } | undefined)?.ok ? { ok: true, msg: `Recherche « ${nom} » lancée dans Outlook` } : repli;
  } catch {
    return repli;
  }
}
