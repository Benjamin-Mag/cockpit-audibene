import { useEffect, useState } from 'preact/hooks';
import { Btn, Icon } from '../components/ui';
import { type Partenaire, type PartenairesCache, REPORT_URL, canFetch, emptyCache, fetchedLabel, isActif, isStale, loadCache, loadPartenaires } from '../partenaires';

interface Props {
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

/** Sans filtre, on ne dessine pas les ~1 200 lignes d'un coup. */
const MAX_SHOWN = 50;

const adresseComplete = (p: Partenaire) => [p.adresse, [p.codePostal, p.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');

export function Partenaires({ toast }: Props) {
  const [cache, setCache] = useState<PartenairesCache | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

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
    return () => { alive = false; };
  }, []);

  const { fetchedAt, items } = cache ?? emptyCache();
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

      {items.length > 0 && <input placeholder="Filtrer par nom, ville ou code postal" value={filter} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} />}

      {cache && items.length === 0 && !loading && !error && (
        <div class="empty">
          <div class="ico"><Icon name="building" size={22} /></div>
          Aucun partenaire en mémoire. Clique ↻ pour lire le rapport <a href={REPORT_URL} target="_blank" rel="noreferrer">FRA Partenaires Actifs</a>.
        </div>
      )}

      {shown.length > 0 && (
        <div class="tpl-list">
          {shown.map((p) => (
            <div key={p.id} class="tpl" style="flex-direction:column;align-items:stretch;gap:2px">
              <div class="row" style="justify-content:space-between">
                <span class="t">{p.nom}</span>
                {!isActif(p) && <span class="badge sms" title={p.statut}>{p.statut.length > 22 ? 'désactivé' : p.statut || 'statut inconnu'}</span>}
              </div>
              <span class="note">{adresseComplete(p) || 'adresse non renseignée'}</span>
            </div>
          ))}
        </div>
      )}
      {rest > 0 && <div class="note" style="text-align:center">… et {rest} autres — filtre pour affiner.</div>}
      {needle && matching.length === 0 && items.length > 0 && <div class="empty">Aucun partenaire ne correspond.</div>}
    </div>
  );
}
