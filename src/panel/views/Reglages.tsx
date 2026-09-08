import type { AppData } from '../model';
import { Btn, Field, Icon, Seg } from '../components/ui';
import type { StorageState } from '../storage/data';
import { fsSupported } from '../storage/fs';

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  storage: StorageState;
  onChangeFolder: () => void;
  onImport: () => void;
  onExport: () => void;
  version: string;
}

export function Reglages({ data, update, storage, onChangeFolder, onImport, onExport, version }: Props) {
  const r = data.reglages;
  const set = <K extends keyof AppData['reglages']>(k: K, v: AppData['reglages'][K]) => update((d) => { d.reglages[k] = v; });
  const input = (k: 'nom' | 'telephone' | 'mvComment', placeholder?: string) => (
    <input value={r[k]} placeholder={placeholder} onInput={(e) => set(k, (e.target as HTMLInputElement).value)} />
  );

  return (
    <div class="view">
      <div class="section-title">Signature</div>
      <Field label="Prénom et nom">{input('nom')}</Field>
      <Field label="Téléphone">{input('telephone', '06 …')}</Field>
      <Field label="Titre"><Seg options={[{ id: 'M', label: 'Conseiller' }, { id: 'F', label: 'Conseillère' }]} value={r.genre} onChange={(g) => set('genre', g)} /></Field>

      <div class="section-title">MV non joignable</div>
      <Field label="Commentaire écrit avant « Piste non joignable »">{input('mvComment', 'MV')}</Field>

      <div class="section-title">Commentaire de fiche</div>
      <label class="checkrow">
        <span class="label">Cliquer Enregistrer automatiquement après « Écrire dans la fiche »</span>
        <input type="checkbox" checked={r.autoSaveComment} onChange={(e) => set('autoSaveComment', (e.target as HTMLInputElement).checked)} />
      </label>

      <div class="section-title">Mails</div>
      <Field label="Pied de page des e-mails">
        <textarea rows={6} value={r.emailFooter} onInput={(e) => set('emailFooter', (e.target as HTMLTextAreaElement).value)} />
      </Field>

      <div class="section-title">Données</div>
      <div class="card" style="animation:none">
        <div class="stack">
          <div class="row"><Icon name="folder" /><span class="grow">{storage.mode === 'folder' ? <>Dossier <b>{storage.folderName}</b> · data.json</> : 'Enregistré dans le navigateur'}</span></div>
          <div class="row wrap">
            {fsSupported && <Btn kind="ghost" icon="folder" onClick={onChangeFolder}>Changer de dossier</Btn>}
            <Btn kind="ghost" icon="upload" onClick={onImport} title="Ancien data.json du générateur, export du suivi des ventes, ou data.json Cockpit">Importer un fichier</Btn>
            <Btn kind="ghost" icon="download" onClick={onExport}>Exporter</Btn>
          </div>
          <div class="note">{data.templates.length} modèle(s) · {data.anamnese.situations.length} situation(s) · {Object.values(data.ventes.sales).flat().length} vente(s)</div>
        </div>
      </div>

      <div class="section-title">Raccourcis</div>
      <div class="kv"><span>Ouvrir / fermer Cockpit</span><span>Ctrl + Shift + Espace</span></div>
      <div class="kv"><span>MV non joignable</span><span>Ctrl + Shift + M</span></div>
      <div class="note">Modifiables dans <code>chrome://extensions/shortcuts</code> (ou <code>edge://extensions/shortcuts</code>).</div>
      <div class="note" style="text-align:center;margin-top:8px">Cockpit Audibene v{version}</div>
    </div>
  );
}
