import type { Site } from '../bridge';
import type { Fiche, RecentPatient, SfContext } from '../../shared/types';
import { Btn, Chip, Icon } from '../components/ui';

interface Props {
  site: Site;
  ctx: SfContext | null;
  fiche: Fiche | null;
  ficheState: 'idle' | 'loading' | 'error';
  recent: RecentPatient[];
  busy: string | null;
  onMv: () => void;
  onRefresh: () => void;
  onPaste: (p: RecentPatient) => void;
  onAddSale: (cat: 1 | 2) => void;
  goTo: (tab: 'anamnese' | 'commentaire' | 'mails' | 'ventes') => void;
}

const civ = (g: 'M' | 'F' | null) => (g === 'F' ? 'Mme' : g === 'M' ? 'M.' : '');
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`;
};

export function Header({ site, ctx, fiche, ficheState, recent, busy, onMv, onRefresh, onPaste, onAddSale, goTo }: Props) {
  const page = ctx?.page ?? 'other';
  const onSf = site === 'salesforce' && !!ctx;
  const hasFiche = !!fiche && !!(fiche.prenom || fiche.nom);
  const siteLabel = site === 'salesforce' ? 'Salesforce' : site === 'doctolib' ? 'Doctolib' : site === 'acuitis' ? 'Acuitis' : 'en attente';
  const isForm = site === 'doctolib' || site === 'acuitis';
  const last = recent[0];

  return (
    <div class="top">
      <div class="brand">
        <span class={['dot', onSf || isForm ? 'on' : ''].join(' ')} />
        <b>Cockpit</b>
        <span>{siteLabel}</span>
      </div>

      <div class="card">
        {site === 'none' && <div class="fiche"><span class="hint">Ouvre une fiche Salesforce, ou un formulaire de RDV Doctolib / Acuitis.</span></div>}

        {isForm && (
          <div class="fiche">
            {!last ? (
              <span class="hint">Aucune fiche mémorisée : ouvre d'abord une fiche patient dans Salesforce, elle apparaîtra ici.</span>
            ) : (
              <>
                <div class="name">{civ(last.genre)} {last.prenom} {last.nom} <span class="tag">dernière fiche · {ago(last.savedAt)}</span></div>
                <div class="meta">
                  {last.telephone && <span>{last.telephone}</span>}
                  {last.naissance && <span><Icon name="calendar" size={12} />{last.naissance}</span>}
                  {last.email && <span>{last.email}</span>}
                </div>
                <div class="actions" style="grid-template-columns:1fr">
                  <Btn big icon="clipboard" busy={busy === 'paste'} onClick={() => onPaste(last)}>
                    Coller {last.prenom} {last.nom} sur {site === 'doctolib' ? 'Doctolib' : 'Acuitis'}
                  </Btn>
                </div>
                {recent.length > 1 && (
                  <div class="stack" style="gap:5px;margin-top:8px">
                    <span class="label muted">Coller une autre fiche récente</span>
                    <div class="chips">
                      {recent.slice(1).map((p) => <Chip key={p.recordId} small onClick={() => onPaste(p)}>{civ(p.genre)} {p.prenom} {p.nom}</Chip>)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {site === 'salesforce' && !ctx && <div class="fiche"><span class="hint">Connexion à la page Salesforce…</span></div>}

        {onSf && (
          <div class="fiche">
            <div class="fiche-head">
              {ficheState === 'loading' ? (
                <div class="stack" style="flex:1;gap:7px">
                  <div class="skeleton" style="width:60%;height:15px" />
                  <div class="skeleton" style="width:85%" />
                </div>
              ) : hasFiche ? (
                <div class="stack" style="gap:3px;flex:1">
                  <div class="name">
                    {civ(fiche!.genre)} {fiche!.prenom} {fiche!.nom}
                    <span class="tag">{page === 'lead' ? 'Piste' : page === 'opportunity' ? 'Opportunité' : 'Fiche'}</span>
                  </div>
                  <div class="meta">
                    {fiche!.telephone && <span>{fiche!.telephone}</span>}
                    {fiche!.naissance && <span><Icon name="calendar" size={12} />{fiche!.naissance}</span>}
                    {fiche!.email && <span>{fiche!.email}</span>}
                    {fiche!.partenaire && <span><Icon name="building" size={12} />{fiche!.partenaire}</span>}
                  </div>
                </div>
              ) : (
                <span class="hint" style="flex:1">
                  {ficheState === 'error' ? 'Lecture impossible — recharge la page Salesforce.' : page === 'other' ? 'Pas de fiche patient sur cette page.' : 'Fiche vide — clique ↻ une fois la page chargée.'}
                </span>
              )}
              <Btn kind="ghost" icon="refresh" title="Relire la fiche" onClick={onRefresh} busy={ficheState === 'loading'} />
            </div>

            {page !== 'opportunity' && (
              <div class="actions" style="grid-template-columns:1fr">
                <Btn big icon="phone-off" busy={busy === 'mv'} onClick={onMv} title="Écrit le commentaire MV, enregistre, puis clique « Piste non joignable »">
                  Message vocal → non joignable
                </Btn>
              </div>
            )}
            <div class="actions" style="margin-top:8px">
              {page !== 'opportunity' && (
                <>
                  <Btn kind="soft" icon="stetho" onClick={() => goTo('anamnese')}>Anamnèse</Btn>
                  <Btn kind="soft" icon="pen" onClick={() => goTo('commentaire')}>Commentaire</Btn>
                </>
              )}
              {page !== 'lead' && <Btn kind="soft" icon="mail" onClick={() => goTo('mails')}>Mail</Btn>}
              {page === 'opportunity' && <Btn kind="ghost" icon="coins" onClick={() => goTo('ventes')}>Ventes</Btn>}
            </div>
            {page === 'opportunity' && hasFiche && (
              <div class="actions" style="margin-top:8px">
                <Btn icon="coins" onClick={() => onAddSale(1)} title="Enregistre la vente dans le mois courant">Vente CAT 1</Btn>
                <Btn icon="coins" onClick={() => onAddSale(2)} title="Enregistre la vente dans le mois courant">Vente CAT 2</Btn>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
