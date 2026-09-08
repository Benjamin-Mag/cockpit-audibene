export const LOGO_URL = 'https://betterhearing.file.force.com/file-asset-public/audibene_Logo_2020?oid=00D24000000KHXk';

const WRAP = '<span style="font-family:Arial,Helvetica,sans-serif;"><span style="font-size:14px;">';
const END = '</span></span>';

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Texte brut → paragraphes HTML tels que l'éditeur Quill de Salesforce les attend. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => (l.trim() === '' ? '<p style="margin:0.8em 0"><br></p>' : `<p style="margin:0">${WRAP}${escapeHtml(l)}${END}</p>`))
    .join('');
}

/** Pied de page : la première ligne de texte (après le trait) en gras, le reste en 13px. */
function footerToHtml(footer: string): string {
  let firstText = true;
  return footer
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => {
      if (l.trim() === '') return '<p><br></p>';
      if (/^_+$/.test(l.trim())) return `<p>${l.trim()}</p>`;
      const inner = firstText ? `<strong>${escapeHtml(l)}</strong>` : escapeHtml(l);
      firstText = false;
      return `<p><span style="font-family:Arial,Helvetica,sans-serif;font-size:13px;">${inner}</span></p>`;
    })
    .join('');
}

/** Corps complet du mail : logo + texte + pied de page. */
export function buildMailHtml(body: string, footer: string): string {
  const logo = `<p><img src="${LOGO_URL}" alt="audibene" width="191" height="86"></p><p><br></p>`;
  return logo + textToHtml(body) + footerToHtml(footer);
}
