import { useState } from 'preact/hooks';
import type { Fiche, Genre } from '../../shared/types';
import { readClipboard, writeClipboard } from '../bridge';
import { type AppData, RESUME_TAG, composeComment, fillVars, resolveGenre, systemValues } from '../model';
import { Btn, Chip, Seg } from '../components/ui';

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  fiche: Fiche | null;
  connected: boolean;
  busy: boolean;
  onWrite: (text: string) => void;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

/** Le presse-papier contient un résumé exploitable (pas vide, pas un JSON technique). */
function usable(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && !(t.startsWith('{') && t.endsWith('}'));
}

export function Commentaire({ data, update, fiche, connected, busy, onWrite, toast }: Props) {
  const [genre, setGenre] = useState<Genre>(fiche?.genre ?? null);
  const [sit, setSit] = useState<string | null>(data.anamnese.situations[0]?.id ?? null);
  const [resume, setResume] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const raw = sit ? data.anamnese.textes[sit] ?? '' : '';
  const effectiveGenre = genre ?? fiche?.genre ?? null;

  const preview = () => {
    const t = resolveGenre(fillVars(raw, systemValues(data.reglages)), effectiveGenre);
    const [before, after] = t.split(RESUME_TAG);
    return (
      <div class="preview">
        {before}
        {after !== undefined && (resume.trim() ? <mark class="ok">{resume.trim()}</mark> : <mark>résumé Salesforce — copie-le, il s'insère ici</mark>)}
        {after}
      </div>
    );
  };

  const grabResume = async () => {
    const txt = await readClipboard();
    if (!usable(txt)) { toast('Le presse-papier ne contient pas de résumé.', 'err'); return false; }
    setResume(txt);
    return true;
  };

  const compose = async (): Promise<string> => {
    let r = resume;
    if (!r.trim()) {
      const txt = await readClipboard();
      if (usable(txt)) { r = txt; setResume(txt); }
    }
    return composeComment(raw, r, data.reglages, effectiveGenre);
  };

  const write = async () => {
    if (!sit) return;
    onWrite(await compose());
  };

  const copy = async () => {
    if (!sit) return;
    const ok = await writeClipboard(await compose());
    toast(ok ? 'Commentaire copié' : 'Copie impossible', ok ? 'ok' : 'err');
  };

  return (
    <div class="view">
      <div class="row wrap" style="justify-content:space-between">
        <Seg options={[{ id: 'M', label: 'M.' }, { id: 'F', label: 'Mme' }]} value={effectiveGenre} onChange={setGenre} />
        {fiche && !genre && fiche.genre && <span class="note">depuis la fiche</span>}
      </div>

      <div class="chips">
        {data.anamnese.situations.map((s) => <Chip key={s.id} on={sit === s.id} onClick={() => { setSit(s.id); setEditing(false); }}>{s.label}</Chip>)}
      </div>

      {sit && !editing && preview()}

      {sit && editing && (
        <div class="stack">
          <textarea rows={9} value={draft} onInput={(e) => setDraft((e.target as HTMLTextAreaElement).value)} />
          <div class="note">Variables : {'{{nom_conseiller}}'}, {'{{tel_conseiller}}'} · {RESUME_TAG} = emplacement du résumé Salesforce · patient(e), il(elle) s'accordent au genre.</div>
          <div class="row">
            <Btn icon="check" onClick={() => { update((d) => { d.anamnese.textes[sit] = draft; }); setEditing(false); toast('Texte enregistré', 'ok'); }} class="grow">Enregistrer le texte</Btn>
            <Btn kind="ghost" onClick={() => setEditing(false)}>Annuler</Btn>
          </div>
        </div>
      )}

      {sit && !editing && (
        <div class="stack">
          <div class="row">
            <Btn kind="soft" icon="clipboard" onClick={grabResume} class="grow" title="Lit le presse-papier et l'affiche dans l'aperçu">
              {resume.trim() ? 'Reprendre le résumé copié' : 'Coller le résumé'}
            </Btn>
            {resume.trim() && <Btn kind="ghost" icon="x" title="Retirer le résumé" onClick={() => setResume('')} />}
            <Btn kind="ghost" icon="pen" title="Modifier ce texte" onClick={() => { setDraft(raw); setEditing(true); }} />
          </div>
          <div class="row">
            <Btn big icon="send" busy={busy} disabled={!connected} onClick={write} class="grow" title="Écrit dans Commentaires internes puis Enregistrer">
              Écrire dans la fiche
            </Btn>
            <Btn kind="ghost" icon="copy" title="Copier le texte" onClick={copy} />
          </div>
          {!connected && <div class="note">Ouvre une Piste Salesforce pour écrire directement dans la fiche.</div>}
        </div>
      )}
    </div>
  );
}
