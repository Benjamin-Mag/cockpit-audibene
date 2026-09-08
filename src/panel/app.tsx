import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContentRequest } from '../shared/messages';
import type { Fiche, SfContext } from '../shared/types';
import { type Site, connectContext, isExtension, onCommand, readFiche, runAction, siteOf, watchActiveTab } from './bridge';
import { Btn, Icon, type IconName, Toast, type ToastMsg } from './components/ui';
import { type AppData } from './model';
import { type StorageState, authorize, chooseFolder, initStorage, parseAny, save, useBrowserStorage } from './storage/data';
import { downloadJson, pickJsonFile } from './storage/fs';
import { Anamnese } from './views/Anamnese';
import { Commentaire } from './views/Commentaire';
import { Header } from './views/Header';
import { Reglages } from './views/Reglages';
import { Setup } from './views/Setup';

type TabId = 'anamnese' | 'commentaire' | 'mails' | 'ventes' | 'reglages';
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'anamnese', label: 'Anamnèse', icon: 'stetho' },
  { id: 'commentaire', label: 'Commentaire', icon: 'pen' },
  { id: 'mails', label: 'Mails', icon: 'mail' },
  { id: 'ventes', label: 'Ventes', icon: 'coins' },
  { id: 'reglages', label: '', icon: 'settings' },
];
const VERSION = isExtension ? chrome.runtime.getManifest().version : 'web';

export function App() {
  const [storage, setStorage] = useState<StorageState | null>(null);
  const [data, setDataState] = useState<AppData | null>(null);
  const skipSave = useRef(true);
  const saveTimer = useRef<number | undefined>(undefined);

  const [tab, setTab] = useState<TabId>('anamnese');
  const [site, setSite] = useState<Site>('none');
  const [tabId, setTabId] = useState<number | null>(null);
  const [ctx, setCtx] = useState<SfContext | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [ficheState, setFicheState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [ficheTick, setFicheTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToastState] = useState<ToastMsg | null>(null);

  const showToast = (msg: string, kind: ToastMsg['kind'] = 'info') => setToastState({ msg, kind, id: Date.now() });

  /** Remplace les données sans déclencher d'enregistrement (chargement, import). */
  const loadData = (d: AppData | null) => { skipSave.current = true; setDataState(d); };
  const update = (fn: (d: AppData) => void) => setDataState((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next; });

  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    if (!data) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => save(data).catch(() => showToast("Erreur d'enregistrement du data.json", 'err')), 350);
  }, [data]);

  useEffect(() => {
    initStorage().then(({ state, data }) => { setStorage(state); loadData(data); });
  }, []);

  useEffect(() => watchActiveTab((t) => { setSite(siteOf(t?.url)); setTabId(t?.id ?? null); }), []);

  useEffect(() => {
    if (site !== 'salesforce' || tabId == null) { setCtx(null); return; }
    return connectContext(tabId, setCtx);
  }, [site, tabId]);

  const recordKey = ctx && ctx.page !== 'other' ? `${ctx.page}:${ctx.recordId}` : '';
  useEffect(() => {
    if (!recordKey || tabId == null) { setFiche(null); setFicheState('idle'); return; }
    let alive = true;
    setFicheState('loading');
    (async () => {
      // La page Salesforce peut encore se dessiner : on réessaie tant que la fiche est vide.
      for (let attempt = 0; attempt < 4 && alive; attempt++) {
        try {
          const f = await readFiche(tabId, false);
          if (!alive) return;
          if (f.prenom || f.nom || attempt === 3) { setFiche(f); setFicheState('idle'); return; }
        } catch {
          if (attempt === 3 && alive) setFicheState('error');
        }
        await new Promise((r) => setTimeout(r, 900));
      }
    })();
    return () => { alive = false; };
  }, [recordKey, tabId, ficheTick]);

  const act = async (label: string, req: ContentRequest) => {
    if (tabId == null) return;
    setBusy(label);
    try {
      const r = await runAction(tabId, req);
      showToast(r.msg, r.ok ? 'ok' : 'err');
      return r;
    } catch (e) {
      showToast((e as Error).message ?? String(e), 'err');
    } finally {
      setBusy(null);
    }
  };
  const runMv = () => act('mv', { type: 'runMv', comment: data?.reglages.mvComment || 'MV' });

  useEffect(() => onCommand(async (c) => { if (c === 'run-mv') await runMv(); }), [tabId, data?.reglages.mvComment]);

  const doChooseFolder = async () => {
    const r = await chooseFolder();
    if (!r) return;
    setStorage(r.state);
    loadData(r.data);
    if (r.existed) showToast(r.data.onboardingDone ? 'Données reprises depuis data.json' : 'data.json repris — finis la configuration', 'ok');
  };

  const doImport = async () => {
    const f = await pickJsonFile();
    if (!f || !data) return;
    try {
      const { data: merged, kind } = parseAny(f.text, data);
      setDataState(merged);
      showToast(kind === 'ventes' ? 'Ventes importées' : kind === 'generateur' ? 'Modèles et textes importés' : 'Données importées', 'ok');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
  };

  const doExport = () => data && downloadJson('data.json', JSON.stringify(data, null, 2));

  // ---------------------------------------------------------------- rendu
  if (!storage) return <div class="empty"><div class="skeleton" style="width:40%;margin:40px auto" /></div>;

  if (storage.status === 'needs-permission') {
    return (
      <div class="setup">
        <img class="logo" src="./icons/icon128.png" alt="" />
        <h1>Accès au dossier</h1>
        <p>Le navigateur demande ton accord pour relire <b>{storage.folderName}</b> (data.json). Choisis « Autoriser à chaque visite » pour ne plus avoir cette étape.</p>
        <Btn big icon="folder" onClick={async () => { const r = await authorize(); setStorage(r.state); loadData(r.data); }}>Autoriser</Btn>
        <Btn kind="ghost" onClick={doChooseFolder}>Choisir un autre dossier</Btn>
      </div>
    );
  }

  if (storage.status === 'needs-folder' || !data || !data.onboardingDone) {
    return (
      <Setup data={data} folderName={storage.folderName} onChooseFolder={doChooseFolder}
        onBrowserStorage={async () => { const r = await useBrowserStorage(); setStorage(r.state); loadData(r.data); }}
        onFinish={(r) => { update((d) => { Object.assign(d.reglages, r); d.onboardingDone = true; }); showToast(`Bienvenue ${r.nom} !`, 'ok'); }} />
    );
  }

  const connected = site === 'salesforce' && !!ctx && ctx.page !== 'other';
  const goTo = (t: TabId) => setTab(t);

  return (
    <>
      <Header site={site} ctx={ctx} fiche={fiche} ficheState={ficheState} busy={busy} onMv={runMv} onRefresh={() => setFicheTick((n) => n + 1)} goTo={goTo} />
      <nav class="tabs">
        {TABS.map((t) => (
          <button key={t.id} class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} title={t.label || 'Réglages'} style={t.label ? '' : 'flex:0 0 auto;padding:6px 10px'}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </nav>
      <main class="content">
        {tab === 'anamnese' && (
          <Anamnese key={recordKey} data={data} update={update} connected={connected && ctx?.page === 'lead'} busy={busy === 'anamnese'}
            onApply={(picklists, texts) => act('anamnese', { type: 'fillAnamnese', picklists, texts })}
            onEmpty={() => showToast('Aucune valeur choisie', 'info')} />
        )}
        {tab === 'commentaire' && (
          <Commentaire key={recordKey} data={data} update={update} fiche={fiche} connected={connected && ctx?.page === 'lead'} busy={busy === 'comment'}
            onWrite={(text) => act('comment', { type: 'writeComment', text })} toast={showToast} />
        )}
        {tab === 'mails' && <div class="empty"><div class="ico"><Icon name="mail" size={28} /></div>Mails — arrive à l'étape 2.<br /><span class="note">{data.templates.length} modèle(s) déjà repris de ton data.json.</span></div>}
        {tab === 'ventes' && <div class="empty"><div class="ico"><Icon name="coins" size={28} /></div>Ventes — arrive à l'étape 3.</div>}
        {tab === 'reglages' && <Reglages data={data} update={update} storage={storage} onChangeFolder={doChooseFolder} onImport={doImport} onExport={doExport} version={VERSION} />}
      </main>
      <Toast toast={toast} />
    </>
  );
}
