import { CONTENT_VERSION } from '../../shared/messages';
import type { AppData } from '../model';
import { Btn, Field, Icon, Seg } from '../components/ui';
import { BACKUP_DIR, type StorageState, backupSupported } from '../storage/data';
import { fsSupported } from '../storage/fs';

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  storage: StorageState;
  onChangeFolder: () => void;
  onAuthorize: () => void;
  onBackupNow: () => void;
  onImport: () => void;
  onExport: () => void;
  onExportLegacy: () => void;
  version: string;
}

export function Reglages({ data, update, storage, onChangeFolder, onAuthorize, onBackupNow, onImport, onExport, onExportLegacy, version }: Props) {
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
          <div class="row"><Icon name="download" /><span class="grow">{backupSupported ? <>Sauvegarde automatique : <b>Téléchargements / {BACKUP_DIR} / cockpit.json</b></> : 'Enregistré dans le navigateur'}</span></div>
          <div class="note">Les données vivent dans le navigateur ; le fichier de sauvegarde est réécrit tout seul (sans aucune autorisation), au plus toutes les 5 min et à la fermeture du panneau.</div>
          <div class="row wrap">
            {backupSupported && <Btn kind="soft" icon="download" onClick={onBackupNow}>Sauvegarder maintenant</Btn>}
            {storage.mode === 'folder' && storage.sync === 'paused' && <Btn kind="ghost" icon="folder" onClick={onAuthorize} title="Le navigateur redemande l'accès à chaque ouverture du panneau">Dossier {storage.folderName} : autoriser</Btn>}
            {fsSupported && <Btn kind="ghost" icon="folder" onClick={onChangeFolder} title="Optionnel — le navigateur redemande l'accès à chaque ouverture">{storage.mode === 'folder' ? 'Changer de dossier' : 'Lier un dossier (optionnel)'}</Btn>}
            <Btn kind="ghost" icon="upload" onClick={onImport} title="data.json de l'ancien générateur, export suivi-ventes-primes-….json, ou cockpit.json">Importer un fichier</Btn>
            <Btn kind="ghost" icon="download" onClick={onExport}>Exporter cockpit.json</Btn>
            <Btn kind="ghost" icon="download" onClick={onExportLegacy} title="Écrit un data.json lisible par l'ancien générateur de mails, dans Téléchargements / Cockpit Audibene">data.json pour l'ancien générateur</Btn>
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
