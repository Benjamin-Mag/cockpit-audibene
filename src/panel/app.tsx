import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContentRequest } from '../shared/messages';
import type { ActionResult, Fiche, RecentPatient, SfContext } from '../shared/types';
import { type Site, connectContext, ensureOrigin, subFrames, isExtension, loadRecent, onCommand, onRecentChanged, pushRecent, readFiche, readPartnerSearch, runAction, sendToFrame, siteOf, watchActiveTab, writeClipboard } from './bridge';
import { Btn, Icon, type IconName, Toast, type ToastMsg } from './components/ui';
import { type AppData, defaultData } from './model';
import { RETARD_JOURS, type StorageState, authorize, chooseFolder, dossierEcritLe, dossierSilencieux, exportLegacy, initStorage, joursSansSauvegarde, parseAny, rappelReporte, reporterRappel, save, setDossierSilencieux, useBrowserStorage } from './storage/data';
import { mergeData, substituteName, toPartage } from './storage/legacy';
import { downloadJson, pickJsonFile } from './storage/fs';
import { Anamnese } from './views/Anamnese';
import { ChatPartenaire } from './views/ChatPartenaire';
import { Commentaire } from './views/Commentaire';
import { Header } from './views/Header';
import { Mails } from './views/Mails';
import { OrlFinder } from './views/OrlFinder';
import { Partenaires } from './views/Partenaires';
import { Reglages } from './views/Reglages';
import { buildMailHtml } from '../shared/mail-html';
import { Setup } from './views/Setup';
import { FICHE_FRAICHE_MS, VERIFICATION_MS, aUnBrouillon, chargerBrouillons, ecranGarde, ficheAvecBrouillon, garderEcran, effacerBrouillon, ficheMemo, ongletSfGarde, setFicheMemo, setOngletSfGarde, verifierOngletsOuverts } from './brouillons';

type TabId = 'fiche' | 'anamnese' | 'commentaire' | 'orl' | 'partenaires' | 'mails' | 'chat' | 'reglages';
interface Ecran { id: TabId; label: string; titre: string; aide: string; icon: IconName; brouillon?: string }
const ECRANS: Record<Exclude<TabId, 'reglages'>, Ecran> = {
  fiche: { id: 'fiche', label: 'Fiche', titre: 'Fiche', aide: '', icon: 'user' },
  anamnese: { id: 'anamnese', label: 'COSI', titre: 'COSI', aide: "Remplir l'onglet Anamnèse par puces", icon: 'stetho', brouillon: 'cosi.' },
  commentaire: { id: 'commentaire', label: 'Anamnèse', titre: 'Anamnèse', aide: 'Résumé + signature dans Remarques générales', icon: 'pen', brouillon: 'anamnese.' },
  orl: { id: 'orl', label: 'ORL Finder', titre: 'ORL Finder', aide: 'ORL proches avec un créneau', icon: 'ear' },
  partenaires: { id: 'partenaires', label: 'Partenaires', titre: 'Partenaires', aide: 'Créneaux Doctolib et Acuitis', icon: 'building' },
  mails: { id: 'mails', label: 'Mails', titre: 'Mails', aide: 'Modèles Client ou Partenaire', icon: 'mail', brouillon: 'mail.' },
  chat: { id: 'chat', label: 'Chat partenaire', titre: 'Chat partenaire', aide: 'Message dans le fil Chatter', icon: 'message', brouillon: 'chat.' },
};
/** Écrans de la barre du bas selon la fiche : une Piste n'envoie pas de mail, une Opportunité n'a ni COSI ni anamnèse. */
const PARCOURS: Record<'lead' | 'opportunity' | 'other', Exclude<TabId, 'reglages'>[]> = {
  lead: ['fiche', 'anamnese', 'commentaire', 'orl', 'partenaires'],
  opportunity: ['fiche', 'mails', 'chat'],
  other: ['fiche', 'anamnese', 'commentaire', 'mails', 'chat'],
};
const VERSION = isExtension ? chrome.runtime.getManifest().version : 'web';
const RDV_NOTE = 'Rendez-vous Audibene';
const ECRITURE_REFUSEE = 'Cockpit n’arrive pas à écrire cockpit.json (lecture seule ?) — tes données restent dans le navigateur';

export function App() {
  const [storage, setStorage] = useState<StorageState | null>(null);
  // Le navigateur oublie l'autorisation du dossier à chaque fermeture : Benjamin peut cesser qu'on la redemande.
  const [silence, setSilence] = useState(dossierSilencieux());
  const [reporte, setReporte] = useState(rappelReporte());
  const [data, setDataState] = useState<AppData | null>(null);
  const skipSave = useRef(true);
  const saveTimer = useRef<number | undefined>(undefined);
  /** save() date les données en place : ce compteur redessine le panneau pour que le bandeau du dossier suive. */
  const [, setEnregistreLe] = useState(0);

  const [tab, setTabState] = useState<TabId>('fiche');
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
  /** Onglet Salesforce gardé pendant que l'utilisateur regarde un autre site (recherche internet…). */
  const [arrierePlan, setArrierePlan] = useState(false);
  const [brouillonsPrets, setBrouillonsPrets] = useState(false);
  const ongletSf = useRef<number | null>(null);

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
        (sync) => { setStorage((s) => (s && s.sync !== sync && s.mode === 'folder' ? { ...s, sync } : s)); setEnregistreLe(data.updatedAt ?? 0); },
        () => showToast("Erreur d'enregistrement", 'err'),
      );
    }, 350);
  }, [data]);

  useEffect(() => {
    initStorage().then(({ state, data }) => { setStorage(state); loadData(data); });
    // Ménage : le cache des partenaires de la v1.0.20 (chantier abandonné) n'a plus d'usage.
    if (isExtension) chrome.storage.local.remove('partenairesCache').catch(() => { /* rien à nettoyer */ });
  }, []);

  // Le panneau suit l'onglet actif, sauf pour un onglet sans rapport (recherche internet, messagerie…) :
  // il garde alors la dernière fiche Salesforce et ses saisies, et les actions visent toujours cet onglet.
  useEffect(() => {
    let appel = 0;
    let stop = () => { /* pas encore branché */ };
    let annule = false;
    // Le panneau est rechargé à chaque changement d'onglet : l'onglet Salesforce suivi est
    // relu en mémoire de session, sinon on perdrait la fiche en passant sur un site quelconque.
    void (async () => {
      const garde = await ongletSfGarde();
      if (annule) return;
      if (ongletSf.current == null) ongletSf.current = garde;
      stop = watchActiveTab(async (t) => {
        const n = ++appel;
        const s = siteOf(t?.url);
        if (s === 'none' && ongletSf.current != null && isExtension) {
          const suivi = ongletSf.current;
          const encore = await chrome.tabs.get(suivi).then((x) => siteOf(x.url) === 'salesforce', () => false);
          if (n !== appel) return;
          if (encore) { setArrierePlan(true); setSite('salesforce'); setTabId(suivi); return; }
        }
        if (s === 'salesforce') { ongletSf.current = t?.id ?? null; setOngletSfGarde(ongletSf.current); }
        else if (s === 'none') { ongletSf.current = null; setOngletSfGarde(null); }
        setArrierePlan(false);
        setSite(s);
        setTabId(t?.id ?? null);
      });
    })();
    return () => { annule = true; stop(); };
  }, []);
  const revenirSurSalesforce = async () => {
    if (!isExtension || ongletSf.current == null) return;
    const t = await chrome.tabs.update(ongletSf.current, { active: true }).catch(() => null);
    if (t?.windowId !== undefined) await chrome.windows.update(t.windowId, { focused: true }).catch(() => undefined);
  };

  // Brouillons par fiche : chargés avant d'afficher les saisies, puis ménage régulier des fiches fermées.
  useEffect(() => {
    chargerBrouillons().then(() => { setBrouillonsPrets(true); void verifierOngletsOuverts(); });
    const t = window.setInterval(() => { void verifierOngletsOuverts(); }, VERIFICATION_MS);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { loadRecent().then(setRecent); return onRecentChanged(setRecent); }, []);

  useEffect(() => {
    if (site !== 'salesforce' || tabId == null) { setCtx(null); return; }
    return connectContext(tabId, setCtx);
  }, [site, tabId]);

  // Toute page Salesforce est tentée (une fiche non reconnue par l'URL peut quand même se lire).
  const recordKey = ctx ? (ctx.recordId ? `${ctx.page}:${ctx.recordId}` : ctx.url) : '';
  // Le navigateur recharge le panneau à chaque changement d'onglet : on réaffiche d'abord la fiche
  // gardée (aucun « chargement… »), et on ne relit Salesforce que si elle date.
  const tickVu = useRef(ficheTick);
  useEffect(() => {
    if (!recordKey || tabId == null) { setFiche(null); setFicheState('idle'); return; }
    const force = ficheTick !== tickVu.current;
    tickVu.current = ficheTick;
    let alive = true;
    const memo = ficheMemo(recordKey);
    // Relecture demandée (↻) : la fiche gardée reste affichée, mais l'état passe en lecture pour que ça se voie.
    if (memo) setFiche(memo.fiche);
    setFicheState(memo && !force ? 'idle' : 'loading');
    if (memo && !force && Date.now() - memo.at < FICHE_FRAICHE_MS) return () => { alive = false; };
    (async () => {
      // La page Salesforce peut encore se dessiner : on réessaie tant que la fiche est vide.
      for (let attempt = 0; attempt < 4 && alive; attempt++) {
        try {
          const f = await readFiche(tabId, false);
          if (!alive) return;
          if (f.prenom || f.nom || attempt === 3) {
            setFiche(f);
            setFicheState('idle');
            if (f.prenom || f.nom) setFicheMemo(recordKey, f);
            if (f.prenom || f.nom) {
              const { page: _p, partenaire: _pa, adresse: _a, codePostal: _cp, ville: _v, recordId, ...patient } = f;
              setRecent(await pushRecent({ ...patient, recordId: recordId || f.prenom + f.nom, savedAt: Date.now() }));
            }
            return;
          }
        } catch (e) {
          // Page muette : inutile de réessayer trois fois 20 s de plus.
          if (/ne répond pas/.test((e as Error)?.message ?? '')) { if (alive) setFicheState(memo ? 'idle' : 'error'); return; }
          if (attempt === 3 && alive) setFicheState(memo ? 'idle' : 'error');
        }
        await new Promise((r) => setTimeout(r, 900));
      }
    })();
    return () => { alive = false; };
  }, [recordKey, tabId, ficheTick]);

  // En revenant sur une fiche (ou quand le navigateur recharge le panneau), on retrouve le dernier écran ouvert.
  // Hors fiche (page Salesforce sans fiche, Doctolib…), l'adresse change à chaque navigation : on ne referme pas Réglages pour autant.
  useEffect(() => {
    if (!brouillonsPrets) return;
    if (ficheAvecBrouillon(recordKey)) setTabState((ecranGarde(recordKey) as TabId | null) ?? 'fiche');
    else setTabState((t) => (t === 'reglages' ? t : 'fiche'));
  }, [recordKey, brouillonsPrets]);

  // Une seule action Salesforce à la fois. Verrou hors de l'état : le raccourci clavier (onCommand)
  // et la palette tiennent une fermeture ancienne où `busy` n'a pas encore changé.
  const actionEnCours = useRef(false);
  const act = async (label: string, req: ContentRequest) => {
    if (tabId == null || actionEnCours.current) return;
    actionEnCours.current = true;
    setBusy(label);
    try {
      const r = await runAction(tabId, req);
      showToast(r.msg, r.ok ? 'ok' : 'err');
      return r;
    } catch (e) {
      showToast((e as Error).message ?? String(e), 'err');
    } finally {
      actionEnCours.current = false;
      setBusy(null);
    }
  };
  const runMv = () => act('mv', { type: 'runMv', comment: data?.reglages.mvComment || 'MV' });
  const pastePatient = (p: RecentPatient) => {
    const { recordId: _r, savedAt: _s, ...patient } = p;
    return act('paste', { type: 'pastePatient', data: patient, note: RDV_NOTE });
  };
  /** Ouvre l'utilitaire SMS (Hearo) puis cherche le patient — la recherche vit souvent dans un cadre intégré, d'où le second envoi à tous les cadres. */
  const openSms = async () => {
    if (tabId == null || !ficheName) return;
    setBusy('sms');
    try {
      // Hearo est une application Canvas : son cadre a son propre domaine, découvert ici.
      // L'accès est demandé au navigateur pendant le clic (une seule fois, puis mémorisé).
      let frames = await subFrames(tabId);
      for (const f of frames) if (!f.own && !/twilio\.com$/.test(f.host)) await ensureOrigin(f.url);

      const opened = await runAction(tabId, { type: 'openSms' });
      if (!opened.ok) { showToast(opened.msg, 'err'); return; }

      let filled: ActionResult | null = null;
      for (let attempt = 0; attempt < 6 && !filled?.ok; attempt++) {
        await new Promise((r) => setTimeout(r, attempt === 0 ? 600 : 800));
        frames = await subFrames(tabId);
        for (const f of frames) {
          if (/twilio\.com$/.test(f.host)) continue;
          if (!(await ensureOrigin(f.url))) continue;
          try {
            const r = await sendToFrame(tabId, f.frameId, { type: 'fillSmsSearch', text: ficheName });
            if (r?.type === 'result' && r.result.ok) { filled = r.result; break; }
          } catch { /* cadre pas prêt */ }
        }
        if (!filled?.ok) {
          // Le champ peut aussi être dans la page principale.
          try {
            const r = (await chrome.tabs.sendMessage(tabId, { type: 'fillSmsSearch', text: ficheName } satisfies ContentRequest, { frameId: 0 })) as { type: 'result'; result: ActionResult } | undefined;
            if (r?.result.ok) filled = r.result;
          } catch { /* rien */ }
        }
      }
      if (filled?.ok) showToast(filled.msg, 'ok');
      else {
        const diag = await runAction(tabId, { type: 'diagSms' });
        const list = frames.map((f) => `  - cadre ${f.frameId}: ${f.host}${f.url.length > f.host.length + 9 ? new URL(f.url).pathname.slice(0, 40) : ''}`).join('\n');
        const perms = chrome.runtime.getManifest().permissions?.join(', ') ?? '';
        await writeClipboard(`Diagnostic SMS Cockpit v${VERSION}\n${diag.msg}\npermissions du manifest chargé: ${perms}\ncadres (webNavigation, ${chrome.webNavigation ? 'ok' : 'API absente'}):\n${list || '  aucun'}`);
        showToast(frames.length ? `Recherche introuvable dans ${frames.map((f) => f.host).join(', ')} — diagnostic copié, colle-le à Claude` : 'Aucun cadre détecté — diagnostic copié, colle-le à Claude', 'err');
      }
    } finally {
      setBusy(null);
    }
  };
  const insertMail = (subject: string, body: string, audience: 'patient' | 'partenaire') => act('mail', { type: 'insertMail', subject, html: buildMailHtml(body, data?.reglages.emailFooter ?? ''), recipient: audience === 'partenaire' ? 'Partenaire' : 'Client' });
  const ficheName = fiche ? [fiche.prenom, fiche.nom].filter(Boolean).join(' ') : '';
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
    showToast(r.state.sync === 'synced' ? `Dossier ${r.state.folderName} synchronisé` : r.state.sync === 'blocked' ? ECRITURE_REFUSEE : 'Accès refusé — les données restent dans le navigateur', r.state.sync === 'synced' ? 'ok' : 'err');
  };

  const doChooseFolder = async () => {
    const r = await chooseFolder(data);
    if (!r) return;
    setStorage(r.state);
    loadData(r.data);
    if (r.state.sync === 'blocked') showToast(ECRITURE_REFUSEE, 'err');
    else if (r.existed === 'cockpit') showToast('Données Cockpit retrouvées', 'ok');
    else if (r.existed === 'legacy') showToast(`${r.data.templates.length} modèle(s) repris de data.json — le fichier reste intact`, 'ok');
  };

  const doImport = async () => {
    const f = await pickJsonFile();
    if (!f) return;
    try {
      const base = data ?? defaultData();
      let { data: merged, kind } = parseAny(f.text, base);
      if (kind === 'cockpit' && data) {
        // Fichier complet d'un collègue : on garde ses propres réglages, on réunit le reste,
        // et le nom de l'auteur écrit en dur devient la variable {{nom_conseiller}}.
        const foreign = merged.reglages.nom;
        merged = mergeData({ ...data, updatedAt: Date.now() }, merged);
        merged.reglages = data.reglages;
        if (foreign && foreign !== data.reglages.nom) merged = substituteName(merged, foreign);
      }
      setDataState(merged);
      // Un export de l'ancien suivi des ventes est gardé dans les données (rien n'est perdu), mais cette version n'a plus de page Ventes.
      showToast(kind === 'ventes' ? 'Suivi des ventes : fichier gardé, mais la page Ventes n\'existe que dans Cockpit Benjamin' : kind === 'generateur' || kind === 'partage' ? `Modèles importés (${merged.templates.length} au total)` : 'Données réunies', kind === 'ventes' ? 'info' : 'ok');
    } catch (e) {
      showToast((e as Error).message, 'err');
    }
  };

  const doExport = () => data && downloadJson('cockpit.json', JSON.stringify(data, null, 2));
  const doExportShare = () => { if (data) { downloadJson('cockpit-modeles.json', JSON.stringify(toPartage(data), null, 2)); showToast('Fichier de partage prêt (modèles, textes, catégories — sans tes réglages ni tes ventes)', 'ok'); } };
  const doExportLegacy = async () => {
    if (!data) return;
    const where = await exportLegacy(data);
    showToast(where === 'folder' ? 'data.json mis à jour pour l\'ancien générateur' : 'data.json téléchargé', 'ok');
  };

  // ---------------------------------------------------------------- rendu
  if (!storage || !brouillonsPrets) return <div class="empty"><div class="skeleton" style="width:40%;margin:40px auto" /></div>;

  if (storage.status === 'needs-folder' || !data || !data.onboardingDone) {
    return (
      <Setup data={data} folderName={storage.folderName} needsFolder={storage.status === 'needs-folder'} onChooseFolder={doChooseFolder}
        onBrowserStorage={async () => { const r = await useBrowserStorage(data); setStorage(r.state); loadData(r.data); }}
        onImport={doImport}
        onFinish={(r) => {
          // Dossier repris d'un collègue : son nom écrit en dur dans les textes devient la variable.
          const previous = data?.reglages.nom ?? '';
          setDataState((prev) => {
            // Jamais de bouton mort : sans données chargées, on part des données par défaut.
            const base = prev ?? defaultData();
            const next = previous && previous !== r.nom ? substituteName(base, previous) : structuredClone(base);
            Object.assign(next.reglages, r);
            next.onboardingDone = true;
            return next;
          });
          showToast(`Bienvenue ${r.nom} !`, 'ok');
        }} />
    );
  }

  // Dès qu'on dialogue avec une page Salesforce, les actions sont proposées : la
  // page dit elle-même si un champ manque, plutôt que de cacher les boutons.
  const connected = site === 'salesforce' && !!ctx;
  // Le bandeau du dossier ne sort que s'il y a vraiment quelque chose à y copier.
  const aCopier = (data.updatedAt ?? 0) > dossierEcritLe();
  const page = connected ? ctx!.page : 'other';
  const parcours = PARCOURS[page];
  const activeTab: TabId = tab === 'reglages' || (parcours as TabId[]).includes(tab) ? tab : 'fiche';
  const setTab = (t: TabId) => { setTabState(t); if (t !== 'reglages') garderEcran(recordKey, t); };
  const hasFiche = !!fiche && !!(fiche.prenom || fiche.nom);
  const civ = fiche?.genre === 'F' ? 'Mme' : fiche?.genre === 'M' ? 'M.' : '';

  return (
    <>
      <Header site={site} ctx={ctx} fiche={fiche} ficheState={ficheState} recent={recent} busy={busy} arrierePlan={arrierePlan} onRevenir={() => void revenirSurSalesforce()} onMv={runMv} onPaste={pastePatient} onSms={openSms} onRefresh={() => setFicheTick((n) => n + 1)}
        compact={activeTab !== 'fiche' && site === 'salesforce'} sansCarte={page === 'lead' && (activeTab === 'anamnese' || activeTab === 'commentaire')} onReglages={() => (activeTab === 'reglages' ? setTabState((ecranGarde(recordKey) as TabId | null) ?? 'fiche') : setTab('reglages'))} reglagesOuverts={activeTab === 'reglages'} />
      {storage.sync === 'paused' && !silence && aCopier && (
        <div class="banner" style="margin:8px 12px 0">
          <Icon name="folder" />
          <span class="grow">Tes changements sont enregistrés dans le navigateur ; la copie de <b>{storage.folderName}</b> attend ton accord.</span>
          <Btn kind="soft" onClick={doAuthorize}>Autoriser</Btn>
          <Btn kind="ghost" onClick={() => { setDossierSilencieux(true); setSilence(true); showToast('Demande masquée — réactivable dans Réglages', 'ok'); }} title="Le navigateur redemande cette autorisation à chaque ouverture du panneau : on peut la masquer, les données restent dans le navigateur">Ne plus demander</Btn>
        </div>
      ) || storage.sync === 'blocked' && (
        <div class="banner" style="margin:8px 12px 0">
          <Icon name="folder" />
          <span class="grow">Cockpit n’arrive pas à écrire cockpit.json dans <b>{storage.folderName}</b> : fichier en lecture seule, ouvert dans un autre programme ou dossier déplacé. Tes données sont à l’abri dans le navigateur.</span>
          <Btn kind="soft" onClick={doAuthorize}>Réessayer</Btn>
        </div>
      ) || storage.sync === 'paused' && aCopier && !reporte && joursSansSauvegarde() >= RETARD_JOURS && (
        <div class="banner" style="margin:8px 12px 0">
          <Icon name="folder" />
          <span class="grow" title={`cockpit.json dans ${storage.folderName}`}>Ta dernière sauvegarde date d’il y a {joursSansSauvegarde()} jours. Mets-la à jour pour ne rien perdre.</span>
          <Btn kind="soft" onClick={doAuthorize}>Mettre à jour</Btn>
          <Btn kind="ghost" onClick={() => { reporterRappel(); setReporte(true); }} title="Le rappel reviendra demain">Plus tard</Btn>
        </div>
      )}
      <main class="content">
        {/* Réglages reste joignable même quand la page Salesforce ne répond pas (connexion, page Setup, script figé). */}
        {site === 'salesforce' && !ctx ? null : <>
        {activeTab === 'fiche' && parcours.length > 1 && site !== 'doctolib' && site !== 'acuitis' && (
          <div class="view accueil">
            <div class="accueil-titre"><span>{hasFiche ? `Suivi de ${civ} ${fiche!.prenom} ${fiche!.nom}`.replace(/\s+/g, ' ') : 'Que veux-tu faire ?'}</span></div>
            <div class="etapes">
              {parcours.filter((id) => id !== 'fiche').map((id) => {
                const e = ECRANS[id];
                const enCours = !!e.brouillon && aUnBrouillon(recordKey, e.brouillon);
                return (
                  <button key={id} type="button" class="etape" onClick={() => setTab(id)}>
                    <span class="ic"><Icon name={e.icon} size={18} /></span>
                    <span class="tx"><b>{e.titre}</b><small>{e.aide}</small></span>
                    {enCours ? <span class="etat">Reprendre</span> : <Icon name="chevron" size={16} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'partenaires' && <Partenaires key={recordKey} ficheKey={recordKey} surPiste={connected && ctx?.page === 'lead'} lire={() => (tabId == null ? Promise.reject(new Error("Pas d'onglet Salesforce.")) : readPartnerSearch(tabId))} />}
        {activeTab === 'anamnese' && (
          <Anamnese key={recordKey} ficheKey={recordKey} data={data} update={update} connected={connected && ctx?.page !== 'opportunity'} busy={busy === 'anamnese'} footerEl={footerEl}
            onApply={(picklists, texts) => act('anamnese', { type: 'fillAnamnese', picklists, texts }).then((r) => { if (r?.ok) effacerBrouillon(recordKey, 'cosi.'); })}
            onEmpty={() => showToast('Aucune valeur choisie', 'info')} />
        )}
        {activeTab === 'commentaire' && (
          <Commentaire key={recordKey} ficheKey={recordKey} data={data} update={update} fiche={fiche} connected={connected && ctx?.page !== 'opportunity'} busy={busy === 'comment'}
            onWrite={(text) => act('comment', { type: 'writeComment', text, save: data.reglages.autoSaveComment }).then((r) => { if (r?.ok) effacerBrouillon(recordKey, 'anamnese.'); })} toast={showToast} />
        )}
        {activeTab === 'orl' && <OrlFinder key={recordKey} ficheKey={recordKey} fiche={fiche} toast={showToast} />}
        {activeTab === 'mails' && (
          <Mails key={recordKey} ficheKey={recordKey} data={data} update={update} fiche={fiche} connected={connected} busy={busy === 'mail'}
            onInsert={(subject, body, audience) => insertMail(subject, body, audience).then((r) => { if (r?.ok) effacerBrouillon(recordKey, 'mail.'); })} onNeedPartner={readPartner} toast={showToast} />
        )}
        {activeTab === 'chat' && (
          <ChatPartenaire key={recordKey} ficheKey={recordKey} data={data} update={update} fiche={fiche} connected={connected && ctx?.page !== 'lead'} busy={busy === 'chat'}
            onWrite={(text) => act('chat', { type: 'writeChatPartenaire', text }).then((r) => { if (r?.ok) effacerBrouillon(recordKey, 'chat.'); })} toast={showToast} />
        )}
        </>}
        {activeTab === 'reglages' && <Reglages data={data} update={update} storage={storage} aCopier={aCopier} silence={silence} onSilence={(v) => { setDossierSilencieux(v); setSilence(v); }} onChangeFolder={doChooseFolder} onAuthorize={doAuthorize} onImport={doImport} onExport={doExport} onExportShare={doExportShare} onExportLegacy={doExportLegacy} version={VERSION} />}
      </main>
      <div class="footer" ref={setFooterEl} />
      <nav class="barre" aria-label="Écrans">
        {parcours.map((id) => {
          const e = ECRANS[id];
          const enCours = !!e.brouillon && aUnBrouillon(recordKey, e.brouillon) && activeTab !== id;
          return (
            <button key={id} type="button" class={activeTab === id ? 'on' : ''} aria-current={activeTab === id ? 'page' : undefined} disabled={site === 'salesforce' && !ctx} onClick={() => setTab(id)} title={e.titre}>
              <span class="pill"><Icon name={e.icon} size={18} />{enCours && <span class="marque" title="Saisie en cours" />}</span>
              {e.label}
            </button>
          );
        })}
      </nav>
      <Toast toast={toast} />
    </>
  );
}
