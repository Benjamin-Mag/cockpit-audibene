// Faux navigateur pour le banc d'essai : remplace chrome.* dans la page du panneau.
// Il joue le rôle de l'onglet Salesforce (script de contenu), de Doctolib et d'Acuitis,
// et note tout ce que le panneau lui demande dans window.__journal.
// Configuration : window.__SCENARIO (posé avant ce script) — voir scenarios.ts.
(() => {
  const S = window.__SCENARIO || {};
  const journal = (window.__journal = []);
  const note = (api, type, detail) => journal.push({ api, type, detail, t: Date.now() });

  const ecouteurs = () => {
    const l = new Set();
    return { addListener: (f) => l.add(f), removeListener: (f) => l.delete(f), hasListener: (f) => l.has(f), _emit: (...a) => [...l].forEach((f) => f(...a)) };
  };

  // ------------------------------------------------------------------ onglets
  const onglets = [
    { id: 11, url: 'https://audibene.lightning.force.com/lightning/r/Lead/PISTETEST0000001A/view', title: 'Piste' },
    { id: 12, url: 'https://audibene.lightning.force.com/lightning/r/Opportunity/OPPORTEST000001AA/view', title: 'Opportunité' },
    { id: 13, url: 'https://www.doctolib.fr/audioprothesiste/paris/centre-test', title: 'Doctolib formulaire' },
    { id: 14, url: 'https://www.google.com/search?q=test', title: 'Google' },
    { id: 15, url: 'https://audibene.lightning.force.com/lightning/page/home', title: 'Accueil SF' },
    { id: 16, url: 'https://rdv.acuitis.com/v3/acuitis/TEST1_ACUITIS?store=TEST1', title: 'Acuitis' },
    { id: 17, url: 'https://rendez-vous.grandaudition.com/ga/centre-test', title: 'Grand Audition' },
    { id: 21, url: 'https://pro.doctolib.fr/doctor_referrals_booking', title: 'Doctolib Pro' },
    { id: 22, url: 'https://www.doctolib.fr/', title: 'Doctolib public' },
  ].map((o) => ({ ...o, active: false, status: 'complete', windowId: 1, discarded: false }));
  const actifInitial = S.onglet ?? 11;
  onglets.forEach((o) => (o.active = o.id === actifInitial));
  if (S.sansDoctolibPro) onglets.splice(onglets.findIndex((o) => o.id === 21), 1);

  const glob = (motif, url) => {
    const re = new RegExp('^' + motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    return re.test(url);
  };
  const onActivated = ecouteurs();
  const onUpdated = ecouteurs();
  const onRemoved = ecouteurs();

  // ------------------------------------------------------------------ fiches
  const FICHES = {
    11: { page: 'lead', recordId: 'PISTETEST0000001A', genre: 'F', prenom: 'Alice', nom: 'Essai', email: 'alice.essai@example.com', telephone: '06 00 00 00 01', naissance: '12/03/1951', codePostal: '75011', ville: 'Paris', rue: '12 rue de l’Essai', partenaire: '', adresse: '' },
    12: { page: 'opportunity', recordId: 'OPPORTEST000001AA', genre: 'M', prenom: 'Bernard', nom: 'Test', email: 'bernard.test@example.com', telephone: '06 00 00 00 02', naissance: '01/01/1948', codePostal: '13002', ville: 'Marseille', partenaire: 'Audition Test Marseille', adresse: '7 rue de l’Essai\n13002 Marseille' },
    15: { page: 'other', recordId: '', genre: null, prenom: '', nom: '', email: '', telephone: '', naissance: '', codePostal: '', ville: '', partenaire: '', adresse: '' },
  };
  if (S.ficheSansGenre) FICHES[11].genre = null;
  const ctxDe = (id) => {
    const o = onglets.find((x) => x.id === id);
    const f = FICHES[id];
    return { page: f?.page ?? 'other', recordId: f?.recordId ?? '', url: o.url };
  };

  const PARTENAIRES = [
    { nom: 'Centre partenaire Doctolib', adresse: '1 rue de l’Essai, 30000 Ville-Test', distance: '3.1 km', duree: '8 mins', pastilles: ['RDV en ligne'], commentaire: 'Prendre RDV sur Doctolib', liens: ['https://www.doctolib.fr/audioprothesiste/ville-test/centre-de-test'] },
    { nom: 'Magasin Acuitis de test', adresse: 'Rue de test, Ville-Test', distance: '12 km', duree: '20 mins', pastilles: [], commentaire: '', liens: ['https://www.acuitis.com/rdv?x=1', 'https://rdv.acuitis.com/v3/acuitis/TEST1_ACUITIS?store=TEST1'] },
    { nom: 'Centre partenaire agenda Pro', adresse: 'Avenue test', distance: '20 km', duree: '30 mins', pastilles: ['Processus ORL géré'], commentaire: '', liens: ['https://pro.doctolib.fr/calendar/centre-test'] },
    { nom: 'Sans Lien Audition', adresse: 'Place test', distance: '25 km', duree: '35 mins', pastilles: [], commentaire: 'Appeler le centre', liens: [] },
  ];

  // Réponses du « script de contenu » (onglet Salesforce / Doctolib / Acuitis).
  const repondre = (tabId, req) => {
    note('page', req.type, req);
    const o = onglets.find((x) => x.id === tabId);
    const site = /force\.com/.test(o?.url) ? 'salesforce' : /doctolib/.test(o?.url) ? 'doctolib' : /grandaudition/.test(o?.url) ? 'grandaudition' : 'acuitis';
    if (S.pageMuette && req.type !== 'ping') return new Promise(() => {});
    switch (req.type) {
      case 'ping': return { type: 'pong', version: 'dev', site };
      case 'getContext': return { type: 'context', context: ctxDe(tabId) };
      case 'readFiche': {
        const f = FICHES[tabId] ?? FICHES[15];
        // Partenaire et adresse : seulement à la lecture complète (survol du lien Compte), comme dans Salesforce.
        return { type: 'fiche', fiche: S.partenaireALaDemande && !req.withPartner ? { ...f, partenaire: '', adresse: '' } : f };
      }
      case 'lirePartnerSearch': return S.partnerSearchVide ? { type: 'partenaires', ok: true, msg: '', partenaires: [] } : { type: 'partenaires', ok: true, msg: '4 partenaires', partenaires: PARTENAIRES };
      case 'diagSms': return { type: 'result', result: { ok: false, msg: 'diag test' } };
      default: {
        const echec = (S.echecs || []).includes(req.type);
        return { type: 'result', result: { ok: !echec, msg: echec ? `Échec simulé ${req.type}` : `OK ${req.type}` } };
      }
    }
  };

  // ------------------------------------------------------------------ Doctolib / Acuitis
  const dans = (j, h = 10, m = 30) => { const d = new Date(Date.now() + j * 86400000); d.setHours(h, m, 0, 0); return d.toISOString(); };
  // 6 ORL par défaut ; `beaucoupOrl` : 30 (plus que l'affichage initial), servis par pages de 16 comme Doctolib.
  const PRENOMS = ['Anne', 'Paul', 'Luc', 'Marie', 'Nina', 'Hugo'];
  const ORL = Array.from({ length: S.beaucoupOrl ? 30 : 6 }, (_, k) => k + 1).map((i) => ({
    title: 'Dr', firstName: PRENOMS[i - 1] ?? 'Prenom' + i, name: 'Orl' + i,
    speciality: { name: 'ORL' },
    location: { address: `${i} rue Test`, zipcode: '7501' + (i % 9), city: i === 4 ? 'Bègles' : 'Paris', lat: 48.85 + i / 100, lng: 2.35, distanceInMeters: i <= 6 ? i * 1200 : 7200 + (i - 6) * 300 },
    regulationSector: i % 2 ? 'CONTRACTED_1' : 'CONTRACTED_2',
    link: `/orl-oto-rhino-laryngologie/paris/dr-orl${i}?pid=practice-${100 + i}`,
    references: { practiceId: 100 + i, id: i },
    matchedVisitMotive: i === 6 ? null : { visitMotiveId: 500 + i, agendaIds: [900 + i, 950 + i], name: 'Première consultation', allowNewPatients: true },
  }));
  const reponseDoctolib = (url) => {
    const u = new URL(url);
    if (S.doctolibBloque) return { status: 403, contentType: 'text/html', body: '<html>captcha</html>' };
    if (/\/hcp\/search/.test(u.pathname)) { const pg = Number(u.searchParams.get('page') || 0); return json({ total: ORL.length, healthcareProviders: ORL.slice(pg * 16, pg * 16 + 16) }); }
    if (/availabilities\.json/.test(u.pathname)) {
      if (u.search.includes('agenda_ids=') ) return { status: 400, contentType: 'application/json', body: '{"error":["agenda_ids: must be an array"]}' };
      const vm = Number(u.searchParams.get('visit_motive_id'));
      if (vm === 503) return json({ total: 0, reason: 'Aucune disponibilité en ligne', availabilities: [] });
      const j = vm % 10 || 1;
      return json({ total: 3, next_slot: null, availabilities: [{ date: dans(j).slice(0, 10), slots: S.creneauxEnDouble ? [dans(j), dans(j), dans(j, 11)] : [dans(j), dans(j, 11)] }] });
    }
    if (/\/profiles\//.test(u.pathname)) {
      const pid = (u.searchParams.get('pid') || '').replace('practice-', '');
      return json({ data: { places: [{ id: `practice-${pid}`, landline_number: pid === '102' ? '' : '01 23 45 67 8' + (pid % 10), full_address: 'Adresse cabinet ' + pid, name: 'Cabinet ' + pid }], details: [{ practice_id: pid, regulation_sector: 'Conventionné secteur 1' }], profile: { skills_by_practice: { [pid]: [{ name: 'Audiométrie tonale' }] } } } });
    }
    if (/info\.json/.test(u.pathname)) return json({ data: { visit_motives: [{ id: 701, name: 'Test auditif' }, { id: 702, name: 'Première consultation avec ordonnance' }, { id: 703, name: 'Première consultation sans ordonnance' }], agendas: [{ id: 801, practice_id: 55, visit_motive_ids: [701, 702, 703] }, { id: 802, practice_id: 55, visit_motive_ids: [701] }] } });
    if (/timeslots\/list/.test(u.pathname)) return json({ availableTimeSlots: [{ date: dans(2) }, { date: dans(2, 14) }, { date: dans(5) }] });
    return { status: 404, contentType: 'application/json', body: '{}' };
  };
  const json = (o) => ({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(o) });

  // ------------------------------------------------------------------ stockage
  const zone = (nom, depart = {}) => {
    const d = { ...depart };
    return {
      _d: d,
      get: async (k) => {
        if (k == null) return { ...d };
        const ks = Array.isArray(k) ? k : typeof k === 'string' ? [k] : Object.keys(k);
        const out = {};
        for (const x of ks) if (x in d) out[x] = structuredClone(d[x]);
        return out;
      },
      set: async (o) => {
        const changes = {};
        for (const [k, v] of Object.entries(o)) { changes[k] = { oldValue: d[k], newValue: v }; d[k] = structuredClone(v); }
        onChanged._emit(changes, nom);
      },
      remove: async (k) => { for (const x of [].concat(k)) delete d[x]; },
    };
  };
  const onChanged = ecouteurs();
  // `localPersistant` : chrome.storage.local survit au rechargement du panneau, comme dans le vrai navigateur.
  let localGarde = null;
  if (S.localPersistant) { try { localGarde = JSON.parse(sessionStorage.getItem('__fauxLocal') || 'null'); } catch {} }
  const local = zone('local', localGarde || S.stockage || {});
  if (S.localPersistant) {
    const garder = () => { try { sessionStorage.setItem('__fauxLocal', JSON.stringify(local._d)); } catch {} };
    const setLocal = local.set;
    const removeLocal = local.remove;
    local.set = async (o) => { await setLocal(o); garder(); };
    local.remove = async (k) => { await removeLocal(k); garder(); };
  }
  let sessionGardee = {};
  try { sessionGardee = JSON.parse(sessionStorage.getItem('__fauxSession') || '{}'); } catch {}
  const session = zone('session', { ...sessionGardee, ...(S.session || {}) });
  const setSession = session.set;
  session.set = async (o) => { await setSession(o); try { sessionStorage.setItem('__fauxSession', JSON.stringify(session._d)); } catch {} };

  // ------------------------------------------------------------------ ports de contexte
  const ports = [];
  const connect = (tabId, info) => {
    note('tabs', 'connect', { tabId, name: info?.name });
    const onMessage = ecouteurs();
    const onDisconnect = ecouteurs();
    const port = { name: info?.name, onMessage, onDisconnect, disconnect: () => note('tabs', 'disconnect', { tabId }), postMessage: () => {} };
    ports.push({ tabId, port });
    setTimeout(() => onMessage._emit({ type: 'contextChanged', context: ctxDe(tabId) }), 30);
    return port;
  };

  const activer = (id) => {
    onglets.forEach((o) => (o.active = o.id === id));
    onActivated._emit({ tabId: id, windowId: 1 });
  };

  window.chrome = {
    runtime: {
      id: 'faux-cockpit',
      getManifest: () => ({ version: '9.9.9-test', permissions: ['sidePanel', 'storage', 'tabs', 'scripting'] }),
      onMessage: ecouteurs(),
      lastError: undefined,
    },
    tabs: {
      query: async (q) => {
        if (q.active) return onglets.filter((o) => o.active);
        if (q.url) { const ms = [].concat(q.url); return onglets.filter((o) => ms.some((m) => glob(m, o.url))); }
        return [...onglets];
      },
      get: async (id) => { const o = onglets.find((x) => x.id === id); if (!o) throw new Error('No tab'); return { ...o }; },
      sendMessage: async (tabId, req) => repondre(tabId, req),
      connect,
      update: async (id, p) => { note('tabs', 'update', { id, ...p }); if (p.active) activer(id); return onglets.find((x) => x.id === id); },
      create: async (p) => {
        note('tabs', 'create', p);
        // Sans session Doctolib Pro, toute page Pro renvoie vers la connexion.
        const url = S.sansDoctolibPro && /^https:\/\/pro\.doctolib\.fr\//.test(p.url) ? 'https://auth.doctolib.fr/pro/sessions/new' : p.url;
        const o = { id: 100 + onglets.length, url, active: !!p.active, status: 'complete', windowId: 1 };
        onglets.push(o);
        return o;
      },
      onActivated, onUpdated, onRemoved,
    },
    windows: { update: async (id, p) => { note('windows', 'update', { id, ...p }); return {}; }, onFocusChanged: ecouteurs() },
    storage: { local, session, onChanged },
    scripting: {
      executeScript: async (opts) => {
        if (opts.files) { note('scripting', 'inject', opts.target); return [{ result: undefined }]; }
        const [url, init] = opts.args || [];
        note('reseau', init?.method || 'GET', url);
        return [{ result: reponseDoctolib(url) }];
      },
    },
    permissions: { contains: async () => true, request: async () => true },
    webNavigation: { getAllFrames: async () => [{ frameId: 0, url: onglets[0].url }] },
  };

  // ------------------------------------------------------------------ dossier synchronisé
  // `dossier` : le dossier est un répertoire du stockage privé du navigateur (OPFS) ; son autorisation
  // est simulée (`permission` au départ, « granted » après le clic Autoriser si `refus` n'est pas posé).
  if (S.dossier && typeof FileSystemHandle !== 'undefined') {
    let perm = S.dossier.permission || 'prompt';
    FileSystemHandle.prototype.queryPermission = async function () { return perm; };
    FileSystemHandle.prototype.requestPermission = async function () { note('dossier', 'requestPermission', {}); if (!S.dossier.refus) perm = 'granted'; return perm; };
    // `lectureSeule` : Windows refuse d'écrire le fichier alors que l'autorisation est accordée (modifiable en cours de test).
    const createWritable = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = async function (...a) {
      if (S.dossier.lectureSeule) { note('dossier', 'ecritureRefusee', {}); throw new DOMException('Fichier en lecture seule', 'NoModificationAllowedError'); }
      return createWritable.apply(this, a);
    };
  }

  window.__mock = { activer, onglets, local, session, FICHES };
})();
