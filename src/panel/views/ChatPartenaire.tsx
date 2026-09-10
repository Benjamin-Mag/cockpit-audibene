import { useEffect, useState } from 'preact/hooks';
import type { Fiche, Genre } from '../../shared/types';
import { writeClipboard } from '../bridge';
import { type AppData, fillVars, resolveGenre, systemValues, uid } from '../model';
import { moveById, useDragReorder } from '../components/drag';
import { Btn, Chip, DeleteBtn, EditablePreview, Seg, previewHtml } from '../components/ui';

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  fiche: Fiche | null;
  connected: boolean;
  busy: boolean;
  onWrite: (text: string) => void;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

export function ChatPartenaire({ data, update, fiche, connected, busy, onWrite, toast }: Props) {
  const list = data.chatPartenaire;
  const [selId, setSelId] = useState<string | null>(list[0]?.id ?? null);
  const [genre, setGenre] = useState<Genre>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ label: '', text: '' });
  const [manage, setManage] = useState(false);
  /** Glisser-déposer : le texte saisi prend la place de celui sur lequel on le lâche (ordre gardé dans cockpit.json). */
  const dnd = useDragReorder((fromId, toId) => update((d) => moveById(d.chatPartenaire, fromId, toId)));

  const sel = list.find((t) => t.id === selId) ?? null;
  const effectiveGenre = genre ?? fiche?.genre ?? null;
  const generated = sel ? resolveGenre(fillVars(sel.text, systemValues(data.reglages)), effectiveGenre).trim() : '';
  const [edited, setEdited] = useState<string | null>(null);
  useEffect(() => { setEdited(null); }, [generated]);
  const compose = () => (edited ?? generated).trim();

  const startNew = () => { setDraft({ label: '', text: '' }); setEditing(true); setSelId(null); };
  const startEdit = () => { if (sel) { setDraft({ label: sel.label, text: sel.text }); setEditing(true); } };
  const saveDraft = () => {
    if (!draft.label.trim() || !draft.text.trim()) { toast('Titre et texte obligatoires', 'err'); return; }
    const id = sel?.id ?? uid('chat');
    update((d) => {
      const i = d.chatPartenaire.findIndex((t) => t.id === id);
      const item = { id, label: draft.label.trim(), text: draft.text };
      if (i === -1) d.chatPartenaire.push(item); else d.chatPartenaire[i] = item;
    });
    setSelId(id);
    setEditing(false);
    toast('Texte enregistré', 'ok');
  };
  const remove = (id: string, label: string) => {
    update((d) => { d.chatPartenaire = d.chatPartenaire.filter((t) => t.id !== id); });
    if (selId === id) setSelId(list.find((t) => t.id !== id)?.id ?? null);
    toast(`Texte « ${label} » supprimé`, 'ok');
  };

  if (editing) {
    return (
      <div class="view">
        <span class="label">{sel ? 'Modifier le texte' : 'Nouveau texte'}</span>
        <input placeholder="Titre (ex. Merci)" value={draft.label} onInput={(e) => setDraft((x) => ({ ...x, label: (e.target as HTMLInputElement).value }))} />
        <textarea rows={8} value={draft.text} onInput={(e) => setDraft((x) => ({ ...x, text: (e.target as HTMLTextAreaElement).value }))} />
        <div class="note">Variables : {'{{nom_conseiller}}'}, {'{{tel_conseiller}}'} · patient(e), il(elle) s'accordent au genre.</div>
        <div class="row">
          <Btn icon="check" onClick={saveDraft} class="grow">Enregistrer</Btn>
          <Btn kind="ghost" onClick={() => { setEditing(false); if (!sel) setSelId(list[0]?.id ?? null); }}>Annuler</Btn>
        </div>
      </div>
    );
  }

  return (
    <div class="view">
      <div class="row" style="justify-content:space-between">
        <Seg options={[{ id: 'M', label: 'M.' }, { id: 'F', label: 'Mme' }]} value={effectiveGenre} onChange={setGenre} />
        <div class="row">
          <Btn kind={manage ? 'soft' : 'ghost'} icon="pen" title="Modifier, supprimer ou réordonner les textes" onClick={() => setManage((v) => !v)} />
          <Btn kind="soft" icon="plus" title="Nouveau texte" onClick={startNew} />
        </div>
      </div>

      {list.length === 0 ? (
        <div class="empty">Aucun texte. Le + en crée un.</div>
      ) : (
        <div class="chips">
          {list.map((t) => (
            <span key={t.id} class={['drag-wrap', dnd.cls(t.id)].join(' ')} title="Glisser pour réordonner" {...dnd.props(t.id)}>
              <Chip on={selId === t.id} onClick={() => setSelId(t.id)}>{t.label}</Chip>
            </span>
          ))}
        </div>
      )}
      {manage && list.length > 0 && (
        <div class="card" style="animation:none">
          <div class="stack" style="gap:6px">
            <span class="label">Textes du Chat partenaire</span>
            <span class="note">Glisse un texte (ici ou sur les puces) pour changer l'ordre.</span>
            {list.map((t) => (
              <div key={t.id} class={['row drag-wrap', dnd.cls(t.id)].join(' ')} {...dnd.props(t.id)}>
                <span class="drag-handle" title="Glisser pour réordonner">⋮⋮</span>
                <span class="grow" style="font-size:12.5px">{t.label}</span>
                <Btn kind="ghost" icon="pen" title="Modifier" onClick={() => { setSelId(t.id); setDraft({ label: t.label, text: t.text }); setEditing(true); }} />
                <DeleteBtn title="Supprimer ce texte" onConfirm={() => remove(t.id, t.label)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {sel && (
        <>
          <EditablePreview html={previewHtml(generated)} onChange={(t) => setEdited(t)} />
          <div class="row">
            <Btn big icon="send" busy={busy} disabled={!connected} onClick={() => onWrite(compose())} class="grow" title="Ouvre l'onglet Chat Partenaire, écrit le texte et clique « Envoyer un message »">
              Envoyer dans Chat Partenaire
            </Btn>
            <Btn kind="ghost" icon="pen" title="Modifier ce texte" onClick={startEdit} />
            <Btn kind="ghost" icon="copy" title="Copier" onClick={async () => toast((await writeClipboard(compose())) ? 'Texte copié' : 'Copie impossible', 'ok')} />
          </div>
          {!connected && <div class="note">Ouvre une Opportunité Salesforce pour coller directement.</div>}
        </>
      )}
    </div>
  );
}
