import { useEffect, useState } from 'preact/hooks';
import type { AppData, Partenaire } from '../model';
import { Btn, Icon } from '../components/ui';
import { REPORT_URL, canFetch, fetchedLabel, isActif, isStale, loadPartenaires } from '../partenaires';

interface Props {
  data: AppData;
  update: (fn: (d: AppData) => void) => void;
  toast: (msg: string, kind?: 'ok' | 'err' | 'info') => void;
}

const adresseComplete = (p: Partenaire) => [p.adresse, [p.codePostal, p.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ');

export function Partenaires({ data, update, toast }: Props) {
  const { fetchedAt, items } = data.partenaires;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const refresh = async (silent: boolean) => {
    if (!canFetch) { if (!silent) setError('Lecture du rapport disponible seulement dans l\'extension.'); return; }
    setLoading(true);
    setError(null);
    try {
      const fresh = await loadPartenaires();
      update((d) => { d.partenaires = fresh; });
      if (!silent) toast(`${fresh.items.length} partenaires lus`, 'ok');
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  // Première ouverture ou liste vieille de plus d'un jour : lecture automatique, sans clic.
  useEffect(() => { if (isStale(data.partenaires)) void refresh(true); }, []);

  const needle = filter.trim().toLowerCase();
  const shown = needle ? items.filter((p) => `${p.nom} ${p.ville} ${p.codePostal} ${p.comptePrincipal}`.toLowerCase().includes(needle)) : items;

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

      {items.length === 0 && !loading && !error && (
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
      {needle && shown.length === 0 && items.length > 0 && <div class="empty">Aucun partenaire ne correspond.</div>}
    </div>
  );
}
