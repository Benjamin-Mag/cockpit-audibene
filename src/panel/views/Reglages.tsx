import { CONTENT_VERSION } from '../../shared/messages';
import type { AppData } from '../model';
import { Btn, Field, Icon, Seg } from '../components/ui';
import type { StorageState } from '../storage/data';
import { fsSupported } from '../storage/fs';

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  storage: StorageState;
  onChangeFolder: () => void;
  onAuthorize: () => void;
  onImport: () => void;
  onExport: () => void;
  onExportLegacy: () => void;
  version: string;
}

export function Reglages({ data, update, storage, onChangeFolder, onAuthorize, onImport, onExport, onExportLegacy, version }: Props) {
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

      <div class="section-title">Anamnèse (commentaire de fiche)</div>
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
          <div class="row"><Icon name="folder" /><span class="grow">{storage.mode === 'folder' ? <>Dossier <b>{storage.folderName}</b> · cockpit.json — {storage.sync === 'synced' ? 'synchronisé' : 'en pause'}</> : 'Enregistré dans le navigateur uniquement'}</span></div>
          <div class="note">Les données sont toujours gardées dans le navigateur ; le dossier sert de copie de sauvegarde et de passerelle avec l'ancien générateur.</div>
          <div class="row wrap">
            {storage.sync === 'paused' && <Btn kind="soft" icon="folder" onClick={onAuthorize}>Autoriser le dossier</Btn>}
            {fsSupported && <Btn kind="ghost" icon="folder" onClick={onChangeFolder}>{storage.mode === 'folder' ? 'Changer de dossier' : 'Choisir un dossier'}</Btn>}
            <Btn kind="ghost" icon="upload" onClick={onImport} title="data.json de l'ancien générateur, export suivi-ventes-primes-….json, ou cockpit.json">Importer un fichier</Btn>
            <Btn kind="ghost" icon="download" onClick={onExport}>Exporter cockpit.json</Btn>
            <Btn kind="ghost" icon="download" onClick={onExportLegacy} title="Écrit un data.json lisible par l'ancien générateur de mails (modèles, textes, signature)">Mettre à jour data.json (ancien générateur)</Btn>
          </div>
          <div class="note">{data.templates.length} modèle(s) · {data.anamnese.situations.length} situation(s) · {Object.values(data.ventes.sales).flat().length} vente(s)</div>
        </div>
      </div>

      <div class="section-title">Raccourcis</div>
      <div class="kv"><span>Ouvrir / fermer Cockpit</span><span>Ctrl + Shift + Espace</span></div>
      <div class="kv"><span>MV non joignable</span><span>Ctrl + Shift + M</span></div>
      <div class="note">Modifiables dans <code>chrome://extensions/shortcuts</code> (ou <code>edge://extensions/shortcuts</code>).</div>
      <div class="note" style="text-align:center;margin-top:8px">Cockpit Audibene v{version} · build {CONTENT_VERSION}</div>
    </div>
  );
}
