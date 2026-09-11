import { useState } from 'preact/hooks';
import type { AppData } from '../model';
import { Btn, Icon, Seg } from '../components/ui';

interface Props {
  /** Données déjà chargées depuis le dossier choisi (null tant qu'aucun dossier). */
  data: AppData | null;
  folderName: string;
  /** Aucun choix de stockage encore fait : proposer le dossier (étape 1). */
  needsFolder: boolean;
  onChooseFolder: () => Promise<void>;
  onBrowserStorage: () => Promise<void>;
  onImport: () => Promise<void>;
  onFinish: (r: { nom: string; telephone: string; genre: 'M' | 'F' }) => void;
}

export function Setup({ data, folderName, needsFolder, onChooseFolder, onBrowserStorage, onImport, onFinish }: Props) {
  const [nom, setNom] = useState(data?.reglages.nom ?? '');
  const [tel, setTel] = useState(data?.reglages.telephone ?? '');
  const [genre, setGenre] = useState<'M' | 'F'>(data?.reglages.genre ?? 'M');
  const [busy, setBusy] = useState(false);
  const step = needsFolder ? 1 : 2;

  return (
    <div class="setup">
      <img class="logo" src="./icons/icon128.png" alt="" />
      <h1>Bienvenue dans Cockpit</h1>
      {step === 1 ? (
        <>
          <p>Tes modèles, textes et ventes sont enregistrés dans un fichier <b>cockpit.json</b>, dans un dossier que tu choisis. Rien ne quitte ton poste.</p>
          <p>Tu utilisais déjà le générateur de mails ? Choisis <b>le même dossier</b> : ton <b>data.json</b> est repris (et laissé intact pour l'ancien générateur).</p>
          <Btn big icon="folder" busy={busy} onClick={async () => { setBusy(true); try { await onChooseFolder(); } finally { setBusy(false); } }}>
            Choisir mon dossier
          </Btn>
          <Btn kind="ghost" onClick={onBrowserStorage}>Sans dossier — enregistrer dans le navigateur</Btn>
        </>
      ) : (
        <>
          {folderName && <p class="row"><Icon name="folder" /> Dossier : <b>{folderName}</b>{data?.templates.length ? ` — ${data.templates.length} modèle(s) repris` : ''}</p>}
          <p>Comment signer tes messages ?</p>
          <div class="stack">
            <input placeholder="Prénom et nom" value={nom} onInput={(e) => setNom((e.target as HTMLInputElement).value)} />
            <input placeholder="Téléphone (optionnel)" value={tel} onInput={(e) => setTel((e.target as HTMLInputElement).value)} />
            <Seg options={[{ id: 'M', label: 'Conseiller' }, { id: 'F', label: 'Conseillère' }]} value={genre} onChange={setGenre} />
          </div>
          <div class="stack" style="gap:6px">
            <Btn kind="ghost" icon="upload" busy={busy} onClick={async () => { setBusy(true); try { await onImport(); } finally { setBusy(false); } }}>
              {data && Object.values(data.ventes.sales).flat().length ? `Ventes importées (${Object.values(data.ventes.sales).flat().length}) — importer un autre fichier` : 'Importer mon export du suivi des ventes'}
            </Btn>
            <p class="note">Fichier <code>suivi-ventes-primes-….json</code> (bouton Exporter de l'ancien suivi). Possible aussi plus tard, dans Réglages.</p>
          </div>
          <Btn big icon="check" disabled={!nom.trim()} onClick={() => onFinish({ nom: nom.trim(), telephone: tel.trim(), genre })}>C'est parti</Btn>
        </>
      )}
    </div>
  );
}
