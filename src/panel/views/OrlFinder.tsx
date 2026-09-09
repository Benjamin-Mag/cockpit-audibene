import { useEffect, useRef, useState } from 'preact/hooks';
import type { Fiche } from '../../shared/types';
import { isExtension, writeClipboard } from '../bridge';
import { Btn, Icon, Seg } from '../components/ui';
import { type Creneau, DoctolibRefus, MESSAGE_TYPE, type Orl, PAUSE_MS, SECTEURS_S1, SECTEURS_S2, creneauLabel, ficheOrl, lienItineraire, lienRechercheDoctolib, prochainCreneau, rechercherOrl, secteurDe, secteurLabel, trierOrl, voirOngletDoctolib } from '../doctolib';
import { type GeoTable, type Origine, kmLabel, loadGeo, localiser } from '../geo';
import { type DelaiFiltre, type LigneCache, type OrlPrefs, type SecteurFiltre, cacheKey, loadPrefs, loadResultat, savePrefs, saveResultat } from '../orl-store';

interface Props {
  fiche: Fiche | null;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

/** Rayons essayés dans l'ordre tant qu'aucun créneau n'est visible. */
const RAYONS_KM = [20, 40, 60];
/** Pages Doctolib lues au maximum (16 praticiens par page, déjà triés par distance). */
const MAX_PAGES = 4;
/** Fiches praticien lues (téléphone, secteur, actes), dans l'ordre du tri, par paquets. */
const MAX_FICHES = 20;
const PAQUET = 5;
const TOP = 3;

type Ligne = LigneCache;
type Etape = 'attente' | 'recherche' | 'creneaux' | 'fiches' | 'fini' | 'erreur';

const DELAIS: { id: `${DelaiFiltre}`; label: string }[] = [{ id: '1', label: '24 h' }, { id: '3', label: '3 j' }, { id: '7', label: '7 j' }, { id: '14', label: '14 j' }, { id: '0', label: 'tous' }];
const SECTEURS: { id: SecteurFiltre; label: string }[] = [{ id: 'tous', label: 'tous' }, { id: 's1', label: 'secteur 1' }, { id: 's12', label: 'secteur 1 + 2' }];

function openUrl(url: string) {
  if (isExtension) void chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener');
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const adresseDe = (l: Ligne) => l.fiche?.adresse || [l.orl.adresse, [l.orl.codePostal, l.orl.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const telephoneDe = (l: Ligne) => (l.fiche ? l.fiche.telephone || l.fiche.telephoneAutre : '');
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "à l'instant" : `il y a ${m} min`; };

function SecteurBadge({ l }: { l: Ligne }) {
  const label = secteurLabel(l.fiche?.secteurClair ?? '', l.orl.secteurBrut);
  if (!label) return <span class="badge" title="Secteur non renseigné sur Doctolib">secteur ⚠️ à confirmer</span>;
  const s1 = label.startsWith('secteur 1');
  return <span class={['badge', s1 ? '' : 'sms'].join(' ')} style={s1 ? 'background:var(--success-soft);color:var(--success);border-color:transparent' : ''} title={l.fiche?.secteurClair || l.orl.secteurBrut || ''}>{label}</span>;
}

export function OrlFinder({ fiche, toast }: Props) {
  const cpPatient = fiche?.codePostal ?? '';
  const lieu = [cpPatient, fiche?.ville].filter(Boolean).join(' ');

  const [geo, setGeo] = useState<GeoTable | null | undefined>(undefined);
  const [prefs, setPrefs] = useState<OrlPrefs | null>(null);
  const [etape, setEtape] = useState<Etape>('attente');
  const [progress, setProgress] = useState({ fait: 0, total: 0 });
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [rayon, setRayon] = useState(RAYONS_KM[0]);
  const [depuisCache, setDepuisCache] = useState<number | null>(null);
  const [error, setError] = useState<{ msg: string; refus: boolean } | null>(null);
  const [origine, setOrigine] = useState<Origine | null>(null);
  const [adressePatient, setAdressePatient] = useState(lieu);
  const [tick, setTick] = useState(0);
  const force = useRef(false);

  useEffect(() => { loadGeo().then(setGeo); loadPrefs().then(setPrefs); }, []);
  useEffect(() => { setAdressePatient(lieu); }, [lieu]);

  const changePrefs = (p: OrlPrefs) => { setPrefs(p); void savePrefs(p); };
  const relancer = () => { force.current = true; setTick((n) => n + 1); };

  // Recherche automatique dès qu'une Piste avec code postal est ouverte (table de coordonnées et réglages chargés).
  useEffect(() => {
    if (!geo || !cpPatient || !prefs) return;
    const o = localiser(cpPatient, geo);
    setOrigine(o);
    if (!o) { setEtape('fini'); setLignes([]); return; }
    let alive = true;
    const forcer = force.current;
    force.current = false;
    (async () => {
      const key = cacheKey(cpPatient, prefs);
      setError(null);
      setDepuisCache(null);
      if (!forcer) {
        const cached = await loadResultat(key);
        if (!alive) return;
        if (cached) { setLignes(cached.lignes); setRayon(cached.rayonKm); setDepuisCache(cached.at); setEtape('fini'); return; }
      }
      setEtape('recherche');
      setLignes([]);
      setRayon(RAYONS_KM[0]);
      try {
        const secteurs = prefs.secteur === 's1' ? SECTEURS_S1 : prefs.secteur === 's12' ? [...SECTEURS_S1, ...SECTEURS_S2] : [];
        const opts = { secteurs, delaiJours: prefs.delai || undefined };

        // 1. Pages Doctolib (déjà triées par distance), lues au fur et à mesure que le rayon s'élargit.
        const lus: Orl[] = [];
        let pages = 0;
        let total = Infinity;
        const lireJusqua = async (km: number) => {
          while (pages < MAX_PAGES && pages * 16 < total && (lus.length === 0 || lus[lus.length - 1].distanceKm <= km)) {
            const r = await rechercherOrl(o.coords[0], o.coords[1], { ...opts, page: pages });
            pages++;
            total = r.total;
            lus.push(...r.items);
            if (!r.items.length) break;
          }
        };

        // 2. Créneaux, en élargissant le rayon tant qu'aucun n'est visible.
        const creneaux = new Map<string, Creneau>();
        let base: Ligne[] = [];
        let rayonKm = RAYONS_KM[0];
        for (const km of RAYONS_KM) {
          rayonKm = km;
          setRayon(km);
          await lireJusqua(km);
          if (!alive) return;
          const vus = new Set<string>();
          base = lus.filter((it) => it.distanceKm <= km && !vus.has(it.key) && vus.add(it.key)).map((orl) => ({ orl, creneau: creneaux.get(orl.key) ?? null, fiche: undefined }));
          setLignes(trierOrl(base));
          setEtape('creneaux');
          const aLire = base.filter((l) => !creneaux.has(l.orl.key));
          setProgress({ fait: 0, total: aLire.length });
          for (let i = 0; i < aLire.length; i++) {
            if (!alive) return;
            let c: Creneau;
            try { c = await prochainCreneau(aLire[i].orl); } catch (e) { if (e instanceof DoctolibRefus) throw e; c = { next: null, raison: (e as Error).message }; }
            creneaux.set(aLire[i].orl.key, c);
            aLire[i].creneau = c;
            if (!alive) return;
            setLignes(trierOrl(base));
            setProgress({ fait: i + 1, total: aLire.length });
            if (i < aLire.length - 1) await sleep(PAUSE_MS);
          }
          if (base.some((l) => l.creneau?.next)) break;
        }

        // 3. Fiches (téléphone, secteur en clair, actes) des premiers du tri, par paquets.
        const retenus = trierOrl(base).slice(0, MAX_FICHES);
        setEtape('fiches');
        setProgress({ fait: 0, total: retenus.length });
        for (let i = 0; i < retenus.length; i += PAQUET) {
          if (!alive) return;
          await Promise.all(retenus.slice(i, i + PAQUET).map(async (l) => {
            try {
              const f = await ficheOrl(l.orl);
              l.fiche = f;
              l.orl = { ...l.orl, secteur: secteurDe(f.secteurClair) ?? l.orl.secteur };
            } catch (e) {
              if (e instanceof DoctolibRefus) throw e;
              l.fiche = null;
              l.ficheErreur = (e as Error).message;
            }
          }));
          if (!alive) return;
          setLignes(trierOrl(base));
          setProgress({ fait: Math.min(i + PAQUET, retenus.length), total: retenus.length });
          if (i + PAQUET < retenus.length) await sleep(PAUSE_MS);
        }
        setEtape('fini');
        void saveResultat(key, { at: Date.now(), rayonKm, lignes: base });
      } catch (e) {
        if (!alive) return;
        setError({ msg: (e as Error).message ?? String(e), refus: e instanceof DoctolibRefus });
        setEtape('erreur');
      }
    })();
    return () => { alive = false; };
  }, [geo, cpPatient, prefs, tick]);

  const enCours = etape === 'recherche' || etape === 'creneaux' || etape === 'fiches';
  // Règle du prompt : pas de téléphone = pas de ligne (le numéro d'un autre cabinet compte, avec mention).
  const finales = lignes.filter((l) => (etape === 'fini' ? !!l.fiche && !!telephoneDe(l) : l.fiche === undefined || !!telephoneDe(l)));
  const sansTel = lignes.filter((l) => l.fiche !== undefined && !telephoneDe(l)).length;
  const nonVerifies = etape === 'fini' ? lignes.filter((l) => l.fiche === undefined).length : 0;
  const top = etape === 'fini' ? finales.filter((l) => l.creneau?.next).sort((a, b) => a.creneau!.next!.localeCompare(b.creneau!.next!)).slice(0, TOP) : [];

  const statut = etape === 'recherche' ? `Recherche des ORL sur Doctolib (${rayon} km)…`
    : etape === 'creneaux' ? `${lignes.length} ORL trouvés, lecture des créneaux… ${progress.fait}/${progress.total}`
    : etape === 'fiches' ? `Lecture des fiches (téléphone, secteur)… ${progress.fait}/${progress.total}`
    : etape === 'fini' && lignes.length ? `${finales.length} ORL avec téléphone à moins de ${rayon} km, ${finales.filter((l) => l.creneau?.next).length} avec un créneau en ligne${depuisCache ? ` · résultats ${ago(depuisCache)}` : ''}`
    : '';

  const copier = async (text: string, ok: string) => toast((await writeClipboard(text)) ? ok : 'Copie impossible', 'ok');
  const itineraire = (l: Ligne) => {
    if (!adressePatient.trim()) { toast('Renseigne l\'adresse du patient', 'err'); return; }
    openUrl(lienItineraire(adressePatient.trim(), adresseDe(l)));
  };
  const carte = (l: Ligne, rang?: number) => <Carte key={rang !== undefined ? `top-${l.orl.key}` : l.orl.key} l={l} rang={rang} onCopier={copier} onItineraire={itineraire} />;

  return (
    <div class="view">
      <div class="row" style="justify-content:space-between">
        <div class="stack" style="gap:2px">
          <span class="label"><Icon name="ear" size={14} /> ORL Finder{lieu ? ` · ${lieu}` : ''}</span>
          {statut && <span class="note">{statut}</span>}
        </div>
        <Btn kind="ghost" icon="refresh" title="Relancer la recherche maintenant (ignore les résultats mémorisés)" onClick={relancer} busy={enCours} disabled={!cpPatient || !geo || !prefs} />
      </div>

      {prefs && cpPatient && (
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:6px">
          <span class="row" style="gap:6px"><span class="note">Créneau sous</span><Seg options={DELAIS} value={`${prefs.delai}`} onChange={(v) => changePrefs({ ...prefs, delai: Number(v) as DelaiFiltre })} /></span>
          <Seg options={SECTEURS} value={prefs.secteur} onChange={(v) => changePrefs({ ...prefs, secteur: v })} />
        </div>
      )}

      {!cpPatient && <div class="note">Aucun code postal lu sur cette Piste — relis la fiche (↻ en haut).</div>}
      {cpPatient && geo === null && <div class="banner"><Icon name="alert" /><span class="grow">Table des codes postaux absente de cette version : impossible de situer le patient.</span></div>}
      {cpPatient && geo && origine === null && etape === 'fini' && <div class="note">Code postal {cpPatient} inconnu de la table des codes postaux.</div>}
      {origine?.mode === 'departement' && <div class="note">Code postal {cpPatient} inconnu : recherche depuis le centre du département {cpPatient.slice(0, 2)}.</div>}

      {error && (
        <div class="card" style="animation:none">
          <div class="stack" style="gap:8px">
            <div class="row" style="align-items:flex-start"><Icon name="alert" /><span class="grow" style="font-size:12.5px">{error.msg}</span></div>
            {error.refus && (
              <div class="actions" style="margin-top:0">
                <Btn big icon="external" onClick={() => void voirOngletDoctolib()} title="Affiche l'onglet Doctolib qui porte les appels, pour valider la vérification anti-robot">Voir l'onglet Doctolib</Btn>
                <Btn big kind="soft" icon="external" onClick={() => openUrl(lienRechercheDoctolib(cpPatient))}>Ouvrir la recherche</Btn>
              </div>
            )}
          </div>
        </div>
      )}

      {cpPatient && (
        <div class="field">
          <div class="field-head">
            <span class="label">Adresse du patient (pour l'itinéraire)</span>
            <Btn kind="ghost" icon="message" title="Copier le message type à envoyer au cabinet" onClick={() => copier(MESSAGE_TYPE, 'Message type copié')}>Message type</Btn>
          </div>
          <input value={adressePatient} placeholder="Rue, code postal, ville" onInput={(e) => setAdressePatient((e.target as HTMLInputElement).value)} />
        </div>
      )}

      {etape === 'recherche' && (
        <div class="tpl-list">
          {[0, 1, 2].map((i) => (
            <div key={i} class="tpl" style="flex-direction:column;align-items:stretch;gap:8px;pointer-events:none">
              <div class="skeleton" style="width:55%;height:14px" />
              <div class="skeleton" style="width:80%" />
              <div class="skeleton" style="width:40%" />
            </div>
          ))}
        </div>
      )}

      {rayon > RAYONS_KM[0] && lignes.length > 0 && <div class="note"><Icon name="pin" size={12} /> Rayon élargi à {rayon} km : aucun créneau visible plus près.</div>}

      {etape === 'fini' && top.length > 0 && (
        <div class="stack" style="gap:6px">
          <span class="label"><Icon name="star" size={13} /> TOP {top.length} · les créneaux les plus rapides</span>
          <div class="tpl-list">{top.map((l, i) => carte(l, i))}</div>
        </div>
      )}

      {finales.length > 0 && (
        <div class="stack" style="gap:6px">
          {etape === 'fini' && top.length > 0 && <span class="label">Tous, secteur 1 d'abord puis distance</span>}
          <div class="tpl-list">{finales.map((l) => carte(l))}</div>
        </div>
      )}

      {etape === 'fini' && (sansTel > 0 || nonVerifies > 0) && (
        <div class="note" style="font-size:11px">
          {sansTel > 0 && `${sansTel} ORL sans numéro sur Doctolib, non affiché${sansTel > 1 ? 's' : ''}. `}
          {nonVerifies > 0 && `${nonVerifies} autre${nonVerifies > 1 ? 's' : ''} non vérifié${nonVerifies > 1 ? 's' : ''} (au-delà des ${MAX_FICHES} fiches lues).`}
        </div>
      )}

      {etape === 'fini' && cpPatient && origine && lignes.length === 0 && !error && (
        <div class="empty">
          <div class="ico"><Icon name="ear" size={22} /></div>
          Aucun ORL trouvé à moins de {rayon} km sur Doctolib avec ces filtres.
          {prefs && (prefs.delai !== 0 || prefs.secteur !== 'tous') && (
            <div style="margin-top:10px"><Btn kind="soft" onClick={() => changePrefs({ delai: 0, secteur: 'tous' })}>Chercher sans filtre (tous délais, tous secteurs)</Btn></div>
          )}
        </div>
      )}
      {etape === 'fini' && lignes.length > 0 && finales.length === 0 && (
        <div class="empty">Aucun ORL avec un numéro de téléphone parmi les {lignes.length} trouvés.</div>
      )}

      {cpPatient && !error?.refus && (
        <Btn kind="ghost" icon="external" onClick={() => openUrl(lienRechercheDoctolib(cpPatient))} title="Ouvre la recherche Doctolib pré-remplie dans un onglet">
          Ouvrir sur Doctolib
        </Btn>
      )}
    </div>
  );
}

interface CarteProps { l: Ligne; rang?: number; onCopier: (text: string, ok: string) => void; onItineraire: (l: Ligne) => void }

/** Une ligne ORL (hors du composant parent pour ne pas être recréée à chaque rendu). */
function Carte({ l, rang, onCopier, onItineraire }: CarteProps) {
  const tel = telephoneDe(l);
  const autre = !!l.fiche && !l.fiche.telephone && !!l.fiche.telephoneAutre;
  return (
    <div class="tpl" style="flex-direction:column;align-items:stretch;gap:4px">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <span class="t">{rang !== undefined && <span class="badge" style="margin-right:6px;background:var(--warn-soft);color:var(--warn);border-color:transparent">TOP {rang + 1}</span>}{l.orl.nom}</span>
        <span class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-end">
          <SecteurBadge l={l} />
          <span class="badge" style="background:var(--accent-soft);color:var(--accent-strong);border-color:transparent">{kmLabel(l.orl.distanceKm)}</span>
        </span>
      </div>
      <span class="note">{adresseDe(l)}</span>
      <span class="note" style={l.creneau?.next ? 'color:var(--success);font-weight:600' : ''}>
        <Icon name="calendar2" size={12} />{' '}
        {l.creneau === null ? 'Prochain RDV : lecture…' : l.creneau.next ? `Prochain RDV : ${creneauLabel(l.creneau.next)}` : `Pas de créneau en ligne${l.creneau.raison ? ` (${l.creneau.raison})` : ''}`}
      </span>
      <span class="note">
        {l.fiche === undefined ? (l.ficheErreur ? `Fiche non lue (${l.ficheErreur})` : 'Fiche : lecture…')
          : l.fiche?.audiometrie ? 'Audiométrie ✅ (indiquée sur la fiche Doctolib)' : 'Audiométrie ⚠️ à confirmer par téléphone'}
      </span>
      {tel && (
        <div class="row" style="gap:6px;flex-wrap:wrap">
          <a href={`tel:${tel.replace(/\s+/g, '')}`} class="btn soft" style="text-decoration:none" title={autre ? `Numéro d'un autre cabinet : ${l.fiche!.autreLieu}` : 'Appeler'}><Icon name="phone" /> {tel}</a>
          {autre && <span class="badge" title={l.fiche!.autreLieu}>autre cabinet</span>}
          <Btn kind="ghost" icon="copy" title="Copier le numéro" onClick={() => onCopier(tel, 'Numéro copié')} />
          <Btn kind="ghost" icon="message" title="Copier le message type (bilan auditif avec audiométrie tonale et vocale)" onClick={() => onCopier(MESSAGE_TYPE, 'Message type copié')} />
        </div>
      )}
      <div class="row" style="gap:6px;margin-top:2px">
        <Btn kind="soft" icon="calendar2" disabled={!l.orl.lien} onClick={() => openUrl(l.orl.lien)} title="Ouvre la page de prise de rendez-vous Doctolib">Prendre RDV</Btn>
        <Btn kind="ghost" icon="route" title="Itinéraire Google Maps depuis l'adresse du patient (envoyée à Google seulement maintenant)" onClick={() => onItineraire(l)}>Itinéraire</Btn>
      </div>
    </div>
  );
}
