import { useEffect, useState } from 'preact/hooks';
import type { Fiche } from '../../shared/types';
import { Btn, Icon } from '../components/ui';
import { type GeoTable, type Origine, kmLabel, loadGeo, localiser, plusProches } from '../geo';
import { type Partenaire, type PartenairesCache, REPORT_URL, canFetch, emptyCache, fetchedLabel, isActif, isStale, loadCache, loadPartenaires } from '../partenaires';

interface Props {
  fiche: Fiche | null;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

/** Sans filtre, on ne dessine pas les ~1 200 lignes d'un coup. */
const MAX_SHOWN = 50;
const NB_PROCHES = 5;

const adresseComplete = (p: Partenaire) => [p.adresse, [p.codePostal, p.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');

function StatutBadge({ p }: { p: Partenaire }) {
  if (isActif(p)) return null;
  return <span class="badge sms" title={p.statut}>{p.statut.length > 22 ? 'désactivé' : p.statut || 'statut inconnu'}</span>;
}

function Carte({ p, km }: { p: Partenaire; km?: number }) {
  return (
    <div class="tpl" style="flex-direction:column;align-items:stretch;gap:2px">
      <div class="row" style="justify-content:space-between">
        <span class="t">{p.nom}</span>
        <span class="row" style="gap:4px">
          <StatutBadge p={p} />
          {km !== undefined && <span class="badge" style="background:var(--accent-soft);color:var(--accent-strong);border-color:transparent">{kmLabel(km)}</span>}
        </span>
      </div>
      <span class="note">{adresseComplete(p) || 'adresse non renseignée'}</span>
    </div>
  );
}

export function Partenaires({ fiche, toast }: Props) {
  const [cache, setCache] = useState<PartenairesCache | null>(null);
  const [geo, setGeo] = useState<GeoTable | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [inclureInactifs, setInclureInactifs] = useState(false);
  const [touteLaListe, setTouteLaListe] = useState(false);

  const refresh = async (silent: boolean) => {
    if (!canFetch) { if (!silent) setError('Lecture du rapport disponible seulement dans l\'extension.'); return; }
    setLoading(true);
    setError(null);
    try {
      const fresh = await loadPartenaires();
      setCache(fresh);
      if (!silent) toast(`${fresh.items.length} partenaires lus`, 'ok');
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  // Cache du navigateur d'abord ; première ouverture ou liste vieille de plus d'un jour → lecture automatique, sans clic.
  useEffect(() => {
    let alive = true;
    loadCache().then((c) => { if (!alive) return; setCache(c); if (isStale(c)) void refresh(true); });
    loadGeo().then((t) => { if (alive) setGeo(t); });
    return () => { alive = false; };
  }, []);

  const { fetchedAt, items } = cache ?? emptyCache();
  const cpPatient = fiche?.codePostal ?? '';
  const origine: Origine | null = geo && cpPatient ? localiser(cpPatient, geo) : null;
  const proches = origine && geo ? plusProches(origine.coords, items, geo, NB_PROCHES, inclureInactifs) : null;
  const lieu = [cpPatient, fiche?.ville].filter(Boolean).join(' ');

  const needle = filter.trim().toLowerCase();
  const matching = needle ? items.filter((p) => `${p.nom} ${p.ville} ${p.codePostal} ${p.comptePrincipal}`.toLowerCase().includes(needle)) : items;
  const shown = needle ? matching : matching.slice(0, MAX_SHOWN);
  const rest = matching.length - shown.length;

  return (
    <div class="view">
      <div class="row" style="justify-content:space-between">
        <div class="stack" style="gap:2px">
          <span class="label">Partenaires <span class="badge">{items.length}</span></span>
          <span class="note">{loading ? 'Lecture du rapport Salesforce…' : fetchedAt ? `Rapport lu ${fetchedLabel(fetchedAt)}` : 'Rapport jamais lu'}</span>
        </div>
        <Btn kind="ghost" icon="refresh" title="Relire le rapport Salesforce maintenant" onClick={() => refresh(false)} busy={loading} />
      </div>

      {error && (
        <div class="banner">
          <Icon name="alert" />
          <span class="grow">{error}{items.length ? ' La dernière liste connue est affichée.' : ''}</span>
        </div>
      )}

      {cache && items.length === 0 && !loading && !error && (
        <div class="empty">
          <div class="ico"><Icon name="building" size={22} /></div>
          Aucun partenaire en mémoire. Clique ↻ pour lire le rapport <a href={REPORT_URL} target="_blank" rel="noreferrer">FRA Partenaires Actifs</a>.
        </div>
      )}

      {items.length > 0 && (
        <div class="stack" style="gap:8px">
          <div class="row" style="justify-content:space-between">
            <span class="label"><Icon name="pin" size={13} /> Les plus proches{lieu ? ` de ${lieu}` : ''}</span>
            <label class="checkrow" style="font-size:12px">
              <input type="checkbox" checked={inclureInactifs} onChange={(e) => setInclureInactifs((e.target as HTMLInputElement).checked)} />
              inclure les désactivés
            </label>
          </div>

          {!cpPatient && <div class="note">Aucun code postal lu sur cette Piste — relis la fiche (↻ en haut) ou cherche dans la liste ci-dessous.</div>}
          {cpPatient && geo === null && <div class="note">Table des codes postaux absente de cette version : distances indisponibles. Cherche dans la liste ci-dessous.</div>}
          {cpPatient && geo && !origine && <div class="note">Code postal {cpPatient} inconnu de la table des codes postaux : distances indisponibles.</div>}
          {origine?.mode === 'departement' && <div class="note">Code postal {cpPatient} inconnu : distances calculées depuis le centre du département {cpPatient.slice(0, 2)}.</div>}

          {proches && proches.items.length > 0 && (
            <div class="tpl-list">
              {proches.items.map(({ p, km }) => <Carte key={p.id} p={p} km={km} />)}
            </div>
          )}
          {proches && proches.items.length === 0 && <div class="note">Aucun partenaire {inclureInactifs ? '' : 'actif '}avec un code postal connu.</div>}
          {proches && proches.ignores > 0 && <div class="note" style="font-size:11px">{proches.ignores} partenaire{proches.ignores > 1 ? 's' : ''} sans code postal connu, non classé{proches.ignores > 1 ? 's' : ''}.</div>}

          <Btn kind={touteLaListe ? 'soft' : 'ghost'} icon="building" onClick={() => setTouteLaListe((v) => !v)} title="Afficher tous les partenaires du rapport">
            {touteLaListe ? 'Masquer toute la liste' : 'Toute la liste'}
          </Btn>
        </div>
      )}

      {touteLaListe && items.length > 0 && (
        <div class="stack" style="gap:8px">
          <input placeholder="Filtrer par nom, ville ou code postal" value={filter} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} />
          {shown.length > 0 && (
            <div class="tpl-list">
              {shown.map((p) => <Carte key={p.id} p={p} />)}
            </div>
          )}
          {rest > 0 && <div class="note" style="text-align:center">… et {rest} autres — filtre pour affiner.</div>}
          {needle && matching.length === 0 && <div class="empty">Aucun partenaire ne correspond.</div>}
        </div>
      )}
    </div>
  );
}
