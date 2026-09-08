import { useState } from 'preact/hooks';
import type { Fiche, Genre } from '../../shared/types';
import { readClipboard, writeClipboard } from '../bridge';
import { type AppData, RESUME_TAG, composeComment, fillVars, resolveGenre, systemValues, uid } from '../model';
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

/** Le presse-papier ressemble à un résumé (pas vide, pas un JSON, pas un simple numéro ou mot). */
function usable(text: string): string | null {
  const t = text.trim();
  if (!t) return 'Le presse-papier est vide.';
  if (t.startsWith('{') && t.endsWith('}')) return 'Le presse-papier contient des données techniques, pas un résumé.';
  if (/^[\d\s+().-]+$/.test(t)) return 'Le presse-papier contient un numéro, pas un résumé.';
  if (t.length < 15) return 'Le presse-papier est trop court pour être un résumé.';
  return null;
}

export function Commentaire({ data, update, fiche, connected, busy, onWrite, toast }: Props) {
  const [genre, setGenre] = useState<Genre>(fiche?.genre ?? null);
  const [sit, setSit] = useState<string | null>(data.anamnese.situations[0]?.id ?? null);
  const [resume, setResume] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [genreAlert, setGenreAlert] = useState(0);
  const [manage, setManage] = useState(false);
  const [newSit, setNewSit] = useState('');

  const addSituation = () => {
    const label = newSit.trim();
    if (!label) return;
    const id = uid('sit');
    update((d) => { d.anamnese.situations.push({ id, label }); d.anamnese.textes[id] = `Cher partenaire, je vous confie notre patient(e).\n\n${RESUME_TAG}\n\nBien à vous,\n{{nom_conseiller}}\n{{tel_conseiller}}`; });
    setNewSit('');
    setSit(id);
  };
  const renameSituation = (id: string, label: string) => {
    const l = label.trim();
    if (!l) return;
    update((d) => { const s = d.anamnese.situations.find((x) => x.id === id); if (s) s.label = l; });
  };
  const deleteSituation = (id: string, label: string) => {
    if (!confirm(`Supprimer la situation « ${label} » et son texte ?`)) return;
    update((d) => { d.anamnese.situations = d.anamnese.situations.filter((x) => x.id !== id); delete d.anamnese.textes[id]; });
    if (sit === id) setSit(data.anamnese.situations.find((x) => x.id !== id)?.id ?? null);
  };

  const raw = sit ? data.anamnese.textes[sit] ?? '' : '';
  const effectiveGenre = genre ?? fiche?.genre ?? null;

  /** Verrou : pas d'anamnèse sans genre choisi (lu sur la fiche ou cliqué). */
  const requireGenre = () => {
    if (effectiveGenre) return true;
    setGenreAlert((n) => n + 1);
    toast('Choisis M. ou Mme avant de générer l\'anamnèse', 'err');
    return false;
  };

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
    const problem = usable(txt);
    if (problem) { toast(problem, 'err'); return; }
    setResume(txt);
    toast('Résumé repris — vérifie l\'aperçu', 'ok');
  };

  // Seul le résumé explicitement collé est utilisé : jamais le presse-papier en douce.
  const compose = () => composeComment(raw, resume, data.reglages, effectiveGenre);

  const write = () => {
    if (!sit || !requireGenre()) return;
    onWrite(compose());
  };

  const copy = async () => {
    if (!sit || !requireGenre()) return;
    const ok = await writeClipboard(compose());
    toast(ok ? 'Anamnèse copiée' : 'Copie impossible', ok ? 'ok' : 'err');
  };

  return (
    <div class="view">
      <div key={genreAlert} class={genreAlert ? 'row wrap shake' : 'row wrap'}>
        <Seg options={[{ id: 'M', label: 'M.' }, { id: 'F', label: 'Mme' }]} value={effectiveGenre} onChange={setGenre} />
        {!effectiveGenre ? <span class="note warn">genre requis</span> : !genre && fiche?.genre ? <span class="note">depuis la fiche</span> : null}
      </div>

      <div class="row" style="align-items:flex-start">
        <div class="chips grow">
          {data.anamnese.situations.map((s) => <Chip key={s.id} on={sit === s.id} onClick={() => { setSit(s.id); setEditing(false); }}>{s.label}</Chip>)}
        </div>
        <Btn kind={manage ? 'soft' : 'ghost'} icon="pen" title="Gérer les situations" onClick={() => setManage((v) => !v)} />
      </div>
      {manage && (
        <div class="card" style="animation:none">
          <div class="stack" style="gap:6px">
            <span class="label">Situations</span>
            {data.anamnese.situations.map((s) => (
              <div key={s.id} class="row">
                <input value={s.label} style="padding:5px 8px;font-size:12px" onChange={(e) => renameSituation(s.id, (e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                <Btn kind="ghost" icon="x" title="Supprimer" onClick={() => deleteSituation(s.id, s.label)} />
              </div>
            ))}
            <div class="row">
              <input value={newSit} placeholder="Nouvelle situation…" style="padding:5px 8px;font-size:12px" onInput={(e) => setNewSit((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSituation(); } }} />
              <Btn kind="soft" icon="plus" title="Ajouter" onClick={addSituation} />
            </div>
            <span class="note">Renommer : modifie le nom puis Entrée. Le texte de chaque situation se modifie avec le crayon sous l'aperçu.</span>
          </div>
        </div>
      )}

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
            <Btn big icon="send" busy={busy} disabled={!connected} onClick={write} class="grow" title="Écrit dans « Remarques générales profil client » (rubrique Commentaire, bas de la fiche)">
              {resume.trim() ? 'Écrire dans la fiche' : 'Écrire sans résumé'}
            </Btn>
            <Btn kind="ghost" icon="copy" title="Copier le texte" onClick={copy} />
          </div>
          <label class="checkrow" style="padding:4px 2px">
            <span class="label muted">Cliquer Enregistrer automatiquement</span>
            <input type="checkbox" checked={data.reglages.autoSaveComment} onChange={(e) => update((d) => { d.reglages.autoSaveComment = (e.target as HTMLInputElement).checked; })} />
          </label>
          {!connected && <div class="note">Ouvre une Piste Salesforce pour écrire directement dans la fiche.</div>}
        </div>
      )}
    </div>
  );
}
