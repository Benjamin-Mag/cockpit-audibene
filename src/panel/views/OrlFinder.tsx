import { useEffect, useState } from 'preact/hooks';
import type { Fiche } from '../../shared/types';
import { isExtension, writeClipboard } from '../bridge';
import { Btn, Icon } from '../components/ui';
import { type Creneau, type FicheOrl, MESSAGE_TYPE, type Orl, PAUSE_MS, creneauLabel, ficheOrl, lienItineraire, lienRechercheDoctolib, prochainCreneau, rechercherOrl, secteurDe, secteurLabel, trierOrl } from '../doctolib';
import { type GeoTable, type Origine, kmLabel, loadGeo, localiser } from '../geo';

interface Props {
  fiche: Fiche | null;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

/** Rayon de recherche (élargissement automatique à l'étape 3). */
const RAYON_KM = 20;
/** Pages Doctolib lues au maximum (16 praticiens par page, déjà triés par distance). */
const MAX_PAGES = 2;
/** Fiches praticien lues au maximum (téléphone, secteur, actes) : les créneaux les plus proches d'abord, puis l'ordre de tri. */
const MAX_FICHES = 12;
const TOP = 3;

interface Ligne { orl: Orl; creneau: Creneau | null; fiche: FicheOrl | null | undefined; ficheErreur?: string }
type Etape = 'attente' | 'recherche' | 'creneaux' | 'fiches' | 'fini' | 'erreur';

function openUrl(url: string) {
  if (isExtension) void chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener');
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const adresseDe = (l: Ligne) => l.fiche?.adresse || [l.orl.adresse, [l.orl.codePostal, l.orl.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');

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
  const [etape, setEtape] = useState<Etape>('attente');
  const [progress, setProgress] = useState({ fait: 0, total: 0 });
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [origine, setOrigine] = useState<Origine | null>(null);
  const [adressePatient, setAdressePatient] = useState(lieu);
  const [tick, setTick] = useState(0);

  useEffect(() => { loadGeo().then(setGeo); }, []);
  useEffect(() => { setAdressePatient(lieu); }, [lieu]);

  // Recherche automatique dès qu'une Piste avec code postal est ouverte (et la table de coordonnées chargée).
  useEffect(() => {
    if (!geo || !cpPatient) return;
    const o = localiser(cpPatient, geo);
    setOrigine(o);
    if (!o) { setEtape('fini'); setLignes([]); return; }
    let alive = true;
    (async () => {
      setEtape('recherche');
      setError(null);
      setLignes([]);
      try {
        // 1. Praticiens dans le rayon (Doctolib les renvoie déjà triés par distance).
        const vus = new Set<string>();
        const trouves: Orl[] = [];
        for (let page = 0; page < MAX_PAGES; page++) {
          const { total, items } = await rechercherOrl(o.coords[0], o.coords[1], { page });
          if (!alive) return;
          for (const it of items) {
            if (it.distanceKm > RAYON_KM || vus.has(it.key)) continue;
            vus.add(it.key);
            trouves.push(it);
          }
          const dernier = items[items.length - 1];
          if (!items.length || (dernier && dernier.distanceKm > RAYON_KM) || (page + 1) * 16 >= total) break;
        }
        const base: Ligne[] = trouves.map((orl) => ({ orl, creneau: null, fiche: undefined }));
        setLignes(trierOrl(base));

        // 2. Prochain créneau de chacun, un appel à la fois.
        setEtape('creneaux');
        setProgress({ fait: 0, total: base.length });
        for (let i = 0; i < base.length; i++) {
          if (!alive) return;
          let creneau: Creneau;
          try { creneau = await prochainCreneau(base[i].orl); } catch (e) { creneau = { next: null, raison: (e as Error).message }; }
          base[i] = { ...base[i], creneau };
          if (!alive) return;
          setLignes(trierOrl(base));
          setProgress({ fait: i + 1, total: base.length });
          if (i < base.length - 1) await sleep(PAUSE_MS);
        }

        // 3. Fiche (téléphone, secteur en clair, actes) des retenus : créneaux les plus proches d'abord, puis l'ordre de tri.
        const parCreneau = base.filter((l) => l.creneau?.next).sort((a, b) => a.creneau!.next!.localeCompare(b.creneau!.next!));
        const retenus: Ligne[] = [];
        for (const l of [...parCreneau, ...trierOrl(base)]) if (!retenus.includes(l) && retenus.length < MAX_FICHES) retenus.push(l);
        setEtape('fiches');
        setProgress({ fait: 0, total: retenus.length });
        for (let i = 0; i < retenus.length; i++) {
          if (!alive) return;
          const idx = base.indexOf(retenus[i]);
          try {
            const f = await ficheOrl(retenus[i].orl);
            base[idx] = { ...base[idx], fiche: f, orl: { ...base[idx].orl, secteur: secteurDe(f.secteurClair) ?? base[idx].orl.secteur } };
          } catch (e) {
            base[idx] = { ...base[idx], fiche: null, ficheErreur: (e as Error).message };
          }
          if (!alive) return;
          setLignes(trierOrl(base));
          setProgress({ fait: i + 1, total: retenus.length });
          if (i < retenus.length - 1) await sleep(PAUSE_MS);
        }
        setEtape('fini');
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message ?? String(e));
        setEtape('erreur');
      }
    })();
    return () => { alive = false; };
  }, [geo, cpPatient, tick]);

  const enCours = etape === 'recherche' || etape === 'creneaux' || etape === 'fiches';
  // Règle du prompt : pas de téléphone = pas de ligne. Tant que la fiche n'est pas lue, la ligne reste visible (en attente).
  const affichees = lignes.filter((l) => l.fiche === undefined || (l.fiche && l.fiche.telephone));
  const sansTel = lignes.filter((l) => l.fiche !== undefined && !(l.fiche && l.fiche.telephone)).length;
  const nonVerifies = etape === 'fini' ? lignes.filter((l) => l.fiche === undefined).length : 0;
  const finales = etape === 'fini' ? affichees.filter((l) => l.fiche) : affichees;
  const top = finales.filter((l) => l.creneau?.next).sort((a, b) => a.creneau!.next!.localeCompare(b.creneau!.next!)).slice(0, TOP);

  const statut = etape === 'recherche' ? 'Recherche des ORL sur Doctolib…'
    : etape === 'creneaux' ? `${lignes.length} ORL trouvés, lecture des créneaux… ${progress.fait}/${progress.total}`
    : etape === 'fiches' ? `Lecture des fiches (téléphone, secteur)… ${progress.fait}/${progress.total}`
    : etape === 'fini' && lignes.length ? `${finales.length} ORL avec téléphone à moins de ${RAYON_KM} km, ${finales.filter((l) => l.creneau?.next).length} avec un créneau en ligne`
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
        <Btn kind="ghost" icon="refresh" title="Relancer la recherche" onClick={() => setTick((n) => n + 1)} busy={enCours} disabled={!cpPatient || !geo} />
      </div>

      {!cpPatient && <div class="note">Aucun code postal lu sur cette Piste — relis la fiche (↻ en haut).</div>}
      {cpPatient && geo === null && <div class="banner"><Icon name="alert" /><span class="grow">Table des codes postaux absente de cette version : impossible de situer le patient.</span></div>}
      {cpPatient && geo && origine === null && etape === 'fini' && <div class="note">Code postal {cpPatient} inconnu de la table des codes postaux.</div>}
      {origine?.mode === 'departement' && <div class="note">Code postal {cpPatient} inconnu : recherche depuis le centre du département {cpPatient.slice(0, 2)}.</div>}
      {error && <div class="banner"><Icon name="alert" /><span class="grow">{error}</span></div>}

      {cpPatient && (
        <div class="field">
          <div class="field-head">
            <span class="label">Adresse du patient (pour l'itinéraire)</span>
            <Btn kind="ghost" icon="message" title="Copier le message type à envoyer au cabinet" onClick={() => copier(MESSAGE_TYPE, 'Message type copié')}>Message type</Btn>
          </div>
          <input value={adressePatient} placeholder="Rue, code postal, ville" onInput={(e) => setAdressePatient((e.target as HTMLInputElement).value)} />
        </div>
      )}

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
          {nonVerifies > 0 && `${nonVerifies} autre${nonVerifies > 1 ? 's' : ''} non vérifié${nonVerifies > 1 ? 's' : ''} (fiche non lue, au-delà des ${MAX_FICHES} retenus).`}
        </div>
      )}

      {etape === 'fini' && cpPatient && origine && lignes.length === 0 && !error && (
        <div class="empty"><div class="ico"><Icon name="ear" size={22} /></div>Aucun ORL trouvé à moins de {RAYON_KM} km sur Doctolib.</div>
      )}
      {etape === 'fini' && lignes.length > 0 && finales.length === 0 && (
        <div class="empty">Aucun ORL avec un numéro de téléphone parmi les {lignes.length} trouvés.</div>
      )}

      {cpPatient && (
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
      {l.fiche?.telephone && (
        <div class="row" style="gap:6px">
          <a href={`tel:${l.fiche.telephone.replace(/\s+/g, '')}`} class="btn soft" style="text-decoration:none" title="Appeler"><Icon name="phone" /> {l.fiche.telephone}</a>
          <Btn kind="ghost" icon="copy" title="Copier le numéro" onClick={() => onCopier(l.fiche!.telephone, 'Numéro copié')} />
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
