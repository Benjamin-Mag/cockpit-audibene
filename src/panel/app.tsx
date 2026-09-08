import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContentRequest } from '../shared/messages';
import type { Fiche, RecentPatient, SfContext } from '../shared/types';
import { type Site, connectContext, isExtension, loadRecent, onCommand, onRecentChanged, pushRecent, readFiche, runAction, siteOf, watchActiveTab } from './bridge';
import { Btn, Icon, type IconName, Toast, type ToastMsg } from './components/ui';
import { type AppData, defaultData } from './model';
import { type StorageState, authorize, chooseFolder, exportLegacy, initStorage, parseAny, save, useBrowserStorage } from './storage/data';
import { downloadJson, pickJsonFile } from './storage/fs';
import { Anamnese } from './views/Anamnese';
import { ChatPartenaire } from './views/ChatPartenaire';
import { Commentaire } from './views/Commentaire';
import { Header } from './views/Header';
import { Mails } from './views/Mails';
import { Reglages } from './views/Reglages';
import { Ventes } from './views/Ventes';
import { buildMailHtml } from '../shared/mail-html';
import { monthKey, monthShort } from './ventes';
import { Setup } from './views/Setup';

type TabId = 'anamnese' | 'commentaire' | 'mails' | 'chat' | 'reglages';
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'anamnese', label: 'COSI', icon: 'stetho' },
  { id: 'commentaire', label: 'Anamnèse', icon: 'pen' },
  { id: 'mails', label: 'Mails', icon: 'mail' },
  { id: 'chat', label: 'Chat partenaire', icon: 'message' },
  { id: 'reglages', label: '', icon: 'settings' },
];
type PageId = 'cockpit' | 'ventes';
const VERSION = isExtension ? chrome.runtime.getManifest().version : 'web';
const RDV_NOTE = 'Rendez-vous Audibene';

export function App() {
  const [storage, setStorage] = useState<StorageState | null>(null);
  const [data, setDataState] = useState<AppData | null>(null);
  const skipSave = useRef(true);
  const saveTimer = useRef<number | undefined>(undefined);

  const [tab, setTab] = useState<TabId>('anamnese');
  const [pageMode, setPageMode] = useState<PageId>('cockpit');
  const [site, setSite] = useState<Site>('none');
  const [tabId, setTabId] = useState<number | null>(null);
  const [ctx, setCtx] = useState<SfContext | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [ficheState, setFicheState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [ficheTick, setFicheTick] = useState(0);
  const [recent, setRecent] = useState<RecentPatient[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToastState] = useState<ToastMsg | null>(null);
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);

  const showToast = (msg: string, kind: ToastMsg['kind'] = 'info') => setToastState({ msg, kind, id: Date.now() });

  /** Remplace les données sans déclencher d'enregistrement (chargement, import). */
  const loadData = (d: AppData | null) => { skipSave.current = true; setDataState(d); };
  const update = (fn: (d: AppData) => void) => setDataState((prev) => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next; });

  useEffect(() => {
    if (skipSave.current) { skipSave.current = false; return; }
    if (!data) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      save(data).then(
        (sync) => setStorage((s) => (s && s.sync !== sync && s.mode === 'folder' ? { ...s, sync } : s)),
        () => showToast("Erreur d'enregistrement", 'err'),
      );
    }, 350);
  }, [data]);

  useEffect(() => {
    initStorage().then(({ state, data }) => { setStorage(state); loadData(data); });
  }, []);

  useEffect(() => watchActiveTab((t) => { setSite(siteOf(t?.url)); setTabId(t?.id ?? null); }), []);
  useEffect(() => { loadRecent().then(setRecent); return onRecentChanged(setRecent); }, []);

  useEffect(() => {
    if (site !== 'salesforce' || tabId == null) { setCtx(null); return; }
    return connectContext(tabId, setCtx);
  }, [site, tabId]);

  // Toute page Salesforce est tentée (une fiche non reconnue par l'URL peut quand même se lire).
  const recordKey = ctx ? (ctx.recordId ? `${ctx.page}:${ctx.recordId}` : ctx.url) : '';
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
          if (f.prenom || f.nom || attempt === 3) {
            setFiche(f);
            setFicheState('idle');
            if (f.prenom || f.nom) {
              const { page: _p, partenaire: _pa, adresse: _a, recordId, ...patient } = f;
              setRecent(await pushRecent({ ...patient, recordId: recordId || f.prenom + f.nom, savedAt: Date.now() }));
            }
            return;
          }
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
  const pastePatient = (p: RecentPatient) => {
    const { recordId: _r, savedAt: _s, ...patient } = p;
    return act('paste', { type: 'pastePatient', data: patient, note: RDV_NOTE });
  };
  const insertMail = (subject: string, body: string) => act('mail', { type: 'insertMail', subject, html: buildMailHtml(body, data?.reglages.emailFooter ?? '') });
  const ficheName = fiche ? [fiche.prenom, fiche.nom].filter(Boolean).join(' ') : '';
  const salePrefill = ficheName && ctx ? { name: ficheName, url: ctx.url.split('?')[0] } : null;
  /** Vente en un clic depuis l'Opportunité ouverte, dans le mois courant. */
  const addSaleFromFiche = (cat: 1 | 2) => {
    if (!salePrefill || !data) return;
    const key = monthKey(new Date());
    if ((data.ventes.sales[key] ?? []).some((s) => s.url === salePrefill.url)) { showToast(`${salePrefill.name} est déjà dans les ventes de ${monthShort(key)}`, 'info'); return; }
    update((d) => { (d.ventes.sales[key] ??= []).push({ name: salePrefill.name, cat, url: salePrefill.url }); });
    showToast(`Vente CAT ${cat} ajoutée : ${salePrefill.name} (${monthShort(key)})`, 'ok');
  };
  /** Lecture complète de la fiche (partenaire + adresse via le survol du lien Compte, ~2 s). */
  const readPartner = async (): Promise<Fiche | null> => {
    if (tabId == null) return null;
    try {
      const f = await readFiche(tabId, true);
      setFiche(f);
      return f;
    } catch {
      return null;
    }
  };

  useEffect(() => onCommand(async (c) => { if (c === 'run-mv') await runMv(); }), [tabId, data?.reglages.mvComment]);

  const doAuthorize = async () => {
    const r = await authorize(data);
    setStorage(r.state);
    if (r.data && r.data !== data) loadData(r.data);
    showToast(r.state.sync === 'synced' ? `Dossier ${r.state.folderName} synchronisé` : 'Accès refusé — les données restent dans le navigateur', r.state.sync === 'synced' ? 'ok' : 'err');
  };

  const doChooseFolder = async () => {
    const r = await chooseFolder(data);
    if (!r) return;
    setStorage(r.state);
    loadData(r.data);
    if (r.existed === 'cockpit') showToast('Données Cockpit retrouvées', 'ok');
    else if (r.existed === 'legacy') showToast(`${r.data.templates.length} modèle(s) repris de data.json — le fichier reste intact`, 'ok');
  };

  const doImport = async () => {
    const f = await pickJsonFile();
    if (!f) return;
    try {
      const { data: merged, kind } = parseAny(f.text, data ?? defaultData());
      setDataState(merged);
      const n = Object.values(merged.ventes.sales).flat().length;
      showToast(kind === 'ventes' ? `Ventes importées (${n})` : kind === 'generateur' ? `${merged.templates.length} modèle(s) importés` : 'Données importées', 'ok');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
  };

  const doExport = () => data && downloadJson('cockpit.json', JSON.stringify(data, null, 2));
  const doExportLegacy = async () => {
    if (!data) return;
    const where = await exportLegacy(data);
    showToast(where === 'folder' ? 'data.json mis à jour pour l\'ancien générateur' : 'data.json téléchargé', 'ok');
  };

  // ---------------------------------------------------------------- rendu
  if (!storage) return <div class="empty"><div class="skeleton" style="width:40%;margin:40px auto" /></div>;

  if (storage.status === 'needs-folder' || !data || !data.onboardingDone) {
    return (
      <Setup data={data} folderName={storage.folderName} onChooseFolder={doChooseFolder}
        onBrowserStorage={async () => { const r = await useBrowserStorage(data); setStorage(r.state); loadData(r.data); }}
        onImport={doImport}
        onFinish={(r) => { update((d) => { Object.assign(d.reglages, r); d.onboardingDone = true; }); showToast(`Bienvenue ${r.nom} !`, 'ok'); }} />
    );
  }

  // Dès qu'on dialogue avec une page Salesforce, les actions sont proposées : la
  // page dit elle-même si un champ manque, plutôt que de cacher les boutons.
  const connected = site === 'salesforce' && !!ctx;
  const goTo = (t: TabId) => { setPageMode('cockpit'); setTab(t); };
  const pageSwitch = (
    <div class="pages">
      <button type="button" class={pageMode === 'cockpit' ? 'on' : ''} onClick={() => setPageMode('cockpit')}><Icon name="stetho" size={13} /> Cockpit</button>
      <button type="button" class={pageMode === 'ventes' ? 'on' : ''} onClick={() => setPageMode('ventes')}><Icon name="coins" size={13} /> Ventes</button>
    </div>
  );

  if (pageMode === 'ventes') {
    return (
      <>
        <div class="top">{pageSwitch}</div>
        <main class="content">
          <Ventes data={data} update={update} prefill={ctx?.page === 'opportunity' ? salePrefill : null} onImport={doImport} toast={showToast} />
        </main>
        <Toast toast={toast} />
      </>
    );
  }

  // Onglets adaptés à la fiche : une Piste n'envoie pas de mail, une Opportunité n'a pas d'anamnèse.
  const page = connected ? ctx!.page : 'other';
  const hidden: TabId[] = page === 'lead' ? ['mails', 'chat'] : page === 'opportunity' ? ['anamnese', 'commentaire'] : [];
  // (les Ventes ont leur propre page, via le sélecteur du haut)
  const visibleTabs = TABS.filter((t) => !hidden.includes(t.id));
  const activeTab: TabId = hidden.includes(tab) ? visibleTabs[0].id : tab;

  return (
    <>
      <div class="top" style="padding-bottom:0">{pageSwitch}</div>
      <Header site={site} ctx={ctx} fiche={fiche} ficheState={ficheState} recent={recent} busy={busy} onMv={runMv} onPaste={pastePatient} onAddSale={addSaleFromFiche} onRefresh={() => setFicheTick((n) => n + 1)} goTo={goTo} />
      {storage.sync === 'paused' && (
        <div class="banner" style="margin:8px 12px 0">
          <Icon name="folder" />
          <span class="grow">Sauvegarde dans <b>{storage.folderName}</b> en pause — les données sont bien dans le navigateur.</span>
          <Btn kind="soft" onClick={doAuthorize}>Autoriser</Btn>
        </div>
      )}
      <nav class="tabs">
        {visibleTabs.map((t) => (
          <button key={t.id} class={activeTab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} title={t.label || 'Réglages'} style={t.label ? '' : 'flex:0 0 auto;padding:6px 10px'}>
            <Icon name={t.icon} size={14} />{t.label}
          </button>
        ))}
      </nav>
      <main class="content">
        {activeTab === 'anamnese' && (
          <Anamnese key={recordKey} data={data} update={update} connected={connected && ctx?.page !== 'opportunity'} busy={busy === 'anamnese'} footerEl={footerEl}
            onApply={(picklists, texts) => act('anamnese', { type: 'fillAnamnese', picklists, texts })}
            onEmpty={() => showToast('Aucune valeur choisie', 'info')} />
        )}
        {activeTab === 'commentaire' && (
          <Commentaire key={recordKey} data={data} update={update} fiche={fiche} connected={connected && ctx?.page !== 'opportunity'} busy={busy === 'comment'}
            onWrite={(text) => act('comment', { type: 'writeComment', text, save: data.reglages.autoSaveComment })} toast={showToast} />
        )}
        {activeTab === 'mails' && (
          <Mails key={recordKey} data={data} update={update} fiche={fiche} connected={connected} busy={busy === 'mail'}
            onInsert={insertMail} onNeedPartner={readPartner} toast={showToast} />
        )}
        {activeTab === 'chat' && (
          <ChatPartenaire key={recordKey} data={data} update={update} fiche={fiche} connected={connected && ctx?.page !== 'lead'} busy={busy === 'chat'}
            onWrite={(text) => act('chat', { type: 'writeChatPartenaire', text })} toast={showToast} />
        )}
        {activeTab === 'reglages' && <Reglages data={data} update={update} storage={storage} onChangeFolder={doChooseFolder} onAuthorize={doAuthorize} onImport={doImport} onExport={doExport} onExportLegacy={doExportLegacy} version={VERSION} />}
      </main>
      <div class="footer" ref={setFooterEl} />
      <Toast toast={toast} />
    </>
  );
}
