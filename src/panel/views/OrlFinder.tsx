import { useEffect, useState } from 'preact/hooks';
import type { Fiche } from '../../shared/types';
import { isExtension } from '../bridge';
import { Btn, Icon } from '../components/ui';
import { type Creneau, type Orl, PAUSE_MS, creneauLabel, lienItineraire, lienRechercheDoctolib, prochainCreneau, rechercherOrl, trierOrl } from '../doctolib';
import { type GeoTable, type Origine, kmLabel, loadGeo, localiser } from '../geo';

interface Props {
  fiche: Fiche | null;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

/** Rayon de recherche (élargissement automatique à l'étape 3). */
const RAYON_KM = 20;
/** Pages Doctolib lues au maximum (16 praticiens par page, déjà triés par distance). */
const MAX_PAGES = 2;

interface Ligne { orl: Orl; creneau: Creneau | null }
type Etape = 'attente' | 'recherche' | 'creneaux' | 'fini' | 'erreur';

function openUrl(url: string) {
  if (isExtension) void chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener');
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function SecteurBadge({ o }: { o: Orl }) {
  if (o.secteur === 'S1') return <span class="badge" style="background:var(--success-soft);color:var(--success);border-color:transparent">secteur 1</span>;
  if (o.secteur === 'S2') return <span class="badge sms" title={o.secteurBrut ?? ''}>secteur 2</span>;
  return <span class="badge" title="Secteur non renseigné sur Doctolib">secteur ⚠️ à confirmer</span>;
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
        const base: Ligne[] = trouves.map((orl) => ({ orl, creneau: null }));
        setLignes(trierOrl(base));
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
        setEtape('fini');
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message ?? String(e));
        setEtape('erreur');
      }
    })();
    return () => { alive = false; };
  }, [geo, cpPatient, tick]);

  const avecCreneau = lignes.filter((l) => l.creneau?.next).length;
  const enCours = etape === 'recherche' || etape === 'creneaux';
  const statut = etape === 'recherche' ? 'Recherche des ORL sur Doctolib…'
    : etape === 'creneaux' ? `${lignes.length} ORL trouvés, lecture des créneaux… ${progress.fait}/${progress.total}`
    : etape === 'fini' && lignes.length ? `${lignes.length} ORL à moins de ${RAYON_KM} km, ${avecCreneau} avec un créneau en ligne`
    : '';

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
          <div class="field-head"><span class="label">Adresse du patient (pour l'itinéraire)</span></div>
          <input value={adressePatient} placeholder="Rue, code postal, ville" onInput={(e) => setAdressePatient((e.target as HTMLInputElement).value)} />
        </div>
      )}

      {lignes.length > 0 && (
        <div class="tpl-list">
          {lignes.map(({ orl, creneau }) => (
            <div key={orl.key} class="tpl" style="flex-direction:column;align-items:stretch;gap:4px">
              <div class="row" style="justify-content:space-between;align-items:flex-start">
                <span class="t">{orl.nom}</span>
                <span class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-end">
                  <SecteurBadge o={orl} />
                  <span class="badge" style="background:var(--accent-soft);color:var(--accent-strong);border-color:transparent">{kmLabel(orl.distanceKm)}</span>
                </span>
              </div>
              <span class="note">{[orl.adresse, [orl.codePostal, orl.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
              <span class="note" style={creneau?.next ? 'color:var(--success);font-weight:600' : ''}>
                <Icon name="calendar2" size={12} />{' '}
                {creneau === null ? 'Prochain RDV : lecture…' : creneau.next ? `Prochain RDV : ${creneauLabel(creneau.next)}` : `Pas de créneau en ligne${creneau.raison ? ` (${creneau.raison})` : ''}`}
              </span>
              <span class="note" style="font-size:11px">Téléphone : à l'étape suivante</span>
              <div class="row" style="gap:6px;margin-top:2px">
                <Btn kind="soft" icon="calendar2" disabled={!orl.lien} onClick={() => openUrl(orl.lien)} title="Ouvre la page de prise de rendez-vous Doctolib">Prendre RDV</Btn>
                <Btn kind="ghost" icon="route" title="Itinéraire Google Maps depuis l'adresse du patient (envoyée à Google seulement maintenant)"
                  onClick={() => { if (!adressePatient.trim()) { toast('Renseigne l\'adresse du patient', 'err'); return; } openUrl(lienItineraire(adressePatient.trim(), [orl.adresse, orl.codePostal, orl.ville].filter(Boolean).join(', '))); }}>
                  Itinéraire
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {etape === 'fini' && cpPatient && origine && lignes.length === 0 && !error && (
        <div class="empty"><div class="ico"><Icon name="ear" size={22} /></div>Aucun ORL trouvé à moins de {RAYON_KM} km sur Doctolib.</div>
      )}

      {cpPatient && (
        <Btn kind="ghost" icon="external" onClick={() => openUrl(lienRechercheDoctolib(cpPatient))} title="Ouvre la recherche Doctolib pré-remplie dans un onglet">
          Ouvrir sur Doctolib
        </Btn>
      )}
    </div>
  );
}
