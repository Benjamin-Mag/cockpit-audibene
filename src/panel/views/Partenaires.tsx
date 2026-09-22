import { useEffect, useRef, useState } from 'preact/hooks';
import type { PartenaireSF } from '../../shared/types';
import { isExtension } from '../bridge';
import { Btn, Icon } from '../components/ui';
import { DoctolibRefus, heureLabel, jourLabel, voirOngletDoctolib } from '../doctolib';
import { type LignePartenaire, type MotifCreneaux, classerLien, lireCreneaux, loadCache, premierCreneau, saveCache, trierPartenaires } from '../partenaires-sf';

interface Props {
  /** Fiche Salesforce ouverte (clé du cache) ; vide hors fiche. */
  ficheKey: string;
  /** Une Piste est ouverte : la page a du contenu. */
  surPiste: boolean;
  /** Lecture de l'onglet Partner Search dans la page Salesforce. */
  lire: () => Promise<{ partenaires: PartenaireSF[]; msg?: string }>;
}

/** Créneaux montrés par motif. */
const CRENEAUX = 3;
type Etape = 'attente' | 'lecture' | 'creneaux' | 'fini' | 'erreur';

function openUrl(url: string) {
  if (isExtension) void chrome.tabs.create({ url });
  else window.open(url, '_blank', 'noopener');
}
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "à l'instant" : `il y a ${m} min`; };

export function Partenaires({ ficheKey, surPiste, lire }: Props) {
  const [etape, setEtape] = useState<Etape>('attente');
  const [lignes, setLignes] = useState<LignePartenaire[]>([]);
  const [note, setNote] = useState('');
  const [depuisCache, setDepuisCache] = useState<number | null>(null);
  const [error, setError] = useState<{ msg: string; refus: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const force = useRef(false);

  useEffect(() => {
    if (!surPiste || !ficheKey) { setEtape('attente'); setLignes([]); return; }
    let alive = true;
    const forcer = force.current;
    force.current = false;
    (async () => {
      setError(null);
      setDepuisCache(null);
      if (!forcer) {
        const c = await loadCache(ficheKey);
        if (!alive) return;
        if (c) { setLignes(c.lignes); setNote(c.msg ?? ''); setDepuisCache(c.at); setEtape('fini'); return; }
      }
      setEtape('lecture');
      setLignes([]);
      setNote('');
      try {
        const { partenaires, msg } = await lire();
        if (!alive) return;
        setNote(msg ?? '');
        const base: LignePartenaire[] = partenaires.map((partenaire, rang) => ({ partenaire, lien: classerLien(partenaire.liens), rang }));
        setLignes(trierPartenaires(base));
        setEtape('creneaux');
        // Créneaux Doctolib des pages publiques, un partenaire après l'autre, dans l'ordre de Partner Search.
        for (const l of base) {
          if (!alive) return;
          if (l.lien.sorte !== 'public') continue;
          const slug = l.lien.slug;
          try {
            l.motifs = await lireCreneaux(slug, () => alive, (partiel) => { l.motifs = partiel; if (alive) setLignes(trierPartenaires(base)); });
          } catch (e) {
            if (e instanceof DoctolibRefus) throw e;
            l.motifs = null;
            l.erreur = (e as Error).message;
          }
          if (alive) setLignes(trierPartenaires(base));
        }
        setEtape('fini');
        void saveCache(ficheKey, { at: Date.now(), lignes: trierPartenaires(base), msg });
      } catch (e) {
        if (!alive) return;
        setError({ msg: (e as Error).message ?? String(e), refus: e instanceof DoctolibRefus });
        setEtape('erreur');
      }
    })();
    return () => { alive = false; };
  }, [ficheKey, surPiste, tick]);

  const enCours = etape === 'lecture' || etape === 'creneaux';
  const avecCreneau = lignes.filter((l) => premierCreneau(l)).length;
  const statut = etape === 'lecture' ? 'Lecture de Partner Search dans Salesforce…'
    : etape === 'creneaux' ? `${lignes.length} partenaire${lignes.length > 1 ? 's' : ''}, lecture des créneaux Doctolib…`
    : etape === 'fini' && lignes.length ? `${lignes.length} partenaire${lignes.length > 1 ? 's' : ''}, ${avecCreneau} avec un créneau Doctolib${depuisCache ? ` · résultats ${ago(depuisCache)}` : ''}`
    : '';

  if (!surPiste) {
    return (
      <div class="view">
        <div class="empty"><div class="ico"><Icon name="building" size={22} /></div>Ouvre une Piste Salesforce : ses partenaires (onglet Partner Search) et leurs créneaux Doctolib s'afficheront ici.</div>
      </div>
    );
  }

  return (
    <div class="view">
      <div class="row" style="justify-content:space-between">
        <div class="stack" style="gap:2px">
          <span class="label"><Icon name="building" size={14} /> Partenaires de la Piste</span>
          {statut && <span class="note">{statut}</span>}
        </div>
        <Btn kind="ghost" icon="refresh" title="Relire Partner Search et les créneaux (ignore les résultats mémorisés)" onClick={() => { force.current = true; setTick((n) => n + 1); }} busy={enCours} />
      </div>

      {note && <div class="note"><Icon name="alert" size={12} /> {note}</div>}

      {error && (
        <div class="card" style="animation:none">
          <div class="stack" style="gap:8px">
            <div class="row" style="align-items:flex-start"><Icon name="alert" /><span class="grow" style="font-size:12.5px">{error.msg}</span></div>
            {error.refus && <Btn big icon="external" onClick={() => void voirOngletDoctolib('public')} title="Affiche l'onglet Doctolib qui porte les appels, pour valider la vérification anti-robot">Voir l'onglet Doctolib</Btn>}
          </div>
        </div>
      )}

      {etape === 'lecture' && (
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

      {lignes.length > 0 && <div class="tpl-list">{lignes.map((l) => <Carte key={`${l.rang}-${l.partenaire.nom}`} l={l} />)}</div>}

      {etape === 'fini' && lignes.length === 0 && !error && (
        <div class="empty"><div class="ico"><Icon name="building" size={22} /></div>Aucun partenaire dans l'onglet Partner Search de cette Piste.</div>
      )}
    </div>
  );
}

function Pastille({ texte }: { texte: string }) {
  const ok = /rdv en ligne|orl g[ée]r[ée]/i.test(texte);
  const attention = /pas sans|sans ordonnance/i.test(texte);
  return <span class={['badge', attention ? 'sms' : ''].join(' ')} style={ok ? 'background:var(--success-soft);color:var(--success);border-color:transparent' : ''}>{texte}</span>;
}

function Motif({ m, url }: { m: MotifCreneaux; url: string }) {
  const jour = m.jour;
  return (
    <div class="stack" style="gap:3px">
      <span class="note" style="font-weight:600;color:var(--text)">{m.motif.nom}</span>
      {m.erreur ? <span class="note">Créneaux non lus ({m.erreur})</span>
        : !jour ? <span class="note">Créneaux : lecture…</span>
        : jour.creneaux.length === 0 ? <span class="note">Pas de créneau en ligne{jour.raison ? ` (${jour.raison})` : ''}</span>
        : (
          <div class="row" style="gap:5px;flex-wrap:wrap">
            <span class="note" style="color:var(--success);font-weight:600"><Icon name="calendar2" size={12} /> {jourLabel(jour.date)}</span>
            {jour.creneaux.slice(0, CRENEAUX).map((c) => <button key={c} type="button" class="chip small" title={`Réserver ${jourLabel(c)} à ${heureLabel(c)} sur Doctolib`} onClick={() => openUrl(url)}>{heureLabel(c)}</button>)}
            {jour.total > CRENEAUX && <span class="note" style="font-size:11px">+ {jour.total - CRENEAUX} autres</span>}
          </div>
        )}
    </div>
  );
}

function Carte({ l }: { l: LignePartenaire }) {
  const [ouvert, setOuvert] = useState(false);
  const p = l.partenaire;
  const lien = l.lien;
  const premier = premierCreneau(l);
  return (
    <div class="tpl" style="flex-direction:column;align-items:stretch;gap:5px">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <span class="t">{p.nom}</span>
        <span class="row" style="gap:4px;flex-wrap:wrap;justify-content:flex-end">
          {p.distance && <span class="badge" style="background:var(--accent-soft);color:var(--accent-strong);border-color:transparent">{p.distance}{p.duree ? ` · ${p.duree}` : ''}</span>}
        </span>
      </div>
      {p.adresse && <span class="note">{p.adresse}</span>}
      {p.pastilles.length > 0 && <div class="row" style="gap:4px;flex-wrap:wrap">{p.pastilles.map((t) => <Pastille key={t} texte={t} />)}</div>}

      {lien.sorte === 'public' && (
        <div class="stack" style="gap:6px;margin-top:2px">
          {l.motifs === undefined && !l.erreur && <span class="note"><Icon name="calendar2" size={12} /> Créneaux Doctolib : lecture…</span>}
          {l.motifs === null && <span class="note">Créneaux Doctolib non lus{l.erreur ? ` (${l.erreur})` : ''}.</span>}
          {l.motifs && l.motifs.length === 0 && <span class="note">Aucun motif « test auditif » ou « première consultation » réservable en ligne.</span>}
          {l.motifs?.map((m) => <Motif key={m.motif.id} m={m} url={lien.url} />)}
          <div class="row" style="gap:6px">
            <Btn kind="soft" icon="calendar2" onClick={() => openUrl(lien.url)} title="Ouvre la page Doctolib du partenaire">{premier ? 'Réserver' : 'Voir sur Doctolib'}</Btn>
          </div>
        </div>
      )}
      {lien.sorte === 'pro' && <div class="row"><Btn kind="soft" icon="calendar2" onClick={() => openUrl(lien.url)} title="Ouvre l'agenda Doctolib Pro du partenaire (secrétariat)">Agenda Doctolib Pro</Btn></div>}
      {lien.sorte === 'autre' && <div class="row"><Btn kind="soft" icon="external" onClick={() => openUrl(lien.url)} title={lien.url}>Prendre RDV sur {new URL(lien.url).hostname.replace(/^www\./, '')}</Btn></div>}

      {p.commentaire && (
        <div class="stack" style="gap:4px">
          <Btn kind="ghost" icon={ouvert ? 'minus' : 'plus'} onClick={() => setOuvert((v) => !v)} title="Commentaire Partnersearch de la fiche">{ouvert ? 'Masquer le commentaire' : 'Commentaire'}</Btn>
          {ouvert && <div class="preview" style="white-space:pre-wrap;font-size:12px">{p.commentaire}</div>}
          {ouvert && lien.sorte === 'aucun' && p.liens.length === 0 && <span class="note">Aucun lien de prise de rendez-vous dans les détails.</span>}
        </div>
      )}
      {!p.commentaire && lien.sorte === 'aucun' && <span class="note">Pas de lien de prise de rendez-vous dans Partner Search : appeler le partenaire.</span>}
    </div>
  );
}
