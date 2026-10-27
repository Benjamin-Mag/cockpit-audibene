import type { Site } from '../bridge';
import type { Fiche, RecentPatient, SfContext } from '../../shared/types';
import { Btn, Chip, Icon } from '../components/ui';
import { BoutonNonJoignable } from '../components/non-joignable';

interface Props {
  site: Site;
  ctx: SfContext | null;
  fiche: Fiche | null;
  ficheState: 'idle' | 'loading' | 'error';
  recent: RecentPatient[];
  busy: string | null;
  /** L'utilisateur regarde un autre site : la fiche affichée est celle de l'onglet Salesforce gardé. */
  arrierePlan: boolean;
  onRevenir: () => void;
  /** Sans argument : MV complet ; « non-joignable » : seulement « Piste non joignable », sans commentaire. */
  onMv: (quoi?: 'non-joignable') => void;
  onRefresh: () => void;
  onPaste: (p: RecentPatient) => void;
  onSms: () => void;
  goTo: (tab: 'anamnese' | 'commentaire' | 'mails' | 'chat') => void;
}

const civ = (g: 'M' | 'F' | null) => (g === 'F' ? 'Mme' : g === 'M' ? 'M.' : '');
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.round(m / 60)} h` : `il y a ${Math.round(m / 1440)} j`;
};

export function Header({ site, ctx, fiche, ficheState, recent, busy, arrierePlan, onRevenir, onMv, onRefresh, onPaste, onSms, goTo }: Props) {
  const page = ctx?.page ?? 'other';
  const onSf = site === 'salesforce' && !!ctx;
  const hasFiche = !!fiche && !!(fiche.prenom || fiche.nom);
  const siteLabel = site === 'salesforce' ? 'Salesforce' : site === 'doctolib' ? 'Doctolib' : site === 'acuitis' ? 'Acuitis' : site === 'grandaudition' ? 'Grand Audition' : 'en attente';
  const isForm = site === 'doctolib' || site === 'acuitis' || site === 'grandaudition';
  const last = recent[0];
  // Sur une fiche Salesforce, le rond dit si le patient est lu (comme dans le nouveau design, v1.1.8) : vert, orange, rouge.
  const etat = onSf && page !== 'other' ? (ficheState === 'loading' ? 'lecture' : hasFiche ? 'ok' : 'ko') : null;
  const etatTitre = etat === 'ok' ? `${civ(fiche!.genre)} ${fiche!.prenom} ${fiche!.nom}`.trim() + ' — patient chargé' : etat === 'lecture' ? 'Lecture du patient…' : 'Patient pas chargé : clique ↻ pour relire la fiche';

  return (
    <div class="top">
      <div class="brand">
        <span class="site" title={etat ? etatTitre : undefined}>
          <span class={['dot', onSf || isForm ? 'on' : '', etat ?? ''].join(' ')} role={etat ? 'status' : undefined} aria-label={etat ? etatTitre : undefined} />
          <span>{siteLabel}</span>
        </span>
        {arrierePlan && (
          <>
            <span class="note" title="Tu regardes un autre site : Cockpit garde ta fiche et tes saisies, et continue d'agir sur l'onglet Salesforce">· onglet en arrière-plan</span>
            <Btn kind="ghost" icon="external" onClick={onRevenir} title="Revenir sur l'onglet Salesforce">Revenir</Btn>
          </>
        )}
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
                  {(last.rue || last.codePostal) && <span><Icon name="pin" size={12} />{[last.rue, [last.codePostal, last.ville].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>}
                </div>
                <div class="actions" style="grid-template-columns:1fr">
                  <Btn big icon="clipboard" busy={busy === 'paste'} onClick={() => onPaste(last)}>
                    Coller {last.prenom} {last.nom} sur {siteLabel}
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
                    {fiche!.codePostal && <span><Icon name="pin" size={12} />{fiche!.rue ? `${fiche!.rue}, ` : ''}{fiche!.codePostal} {fiche!.ville}</span>}
                    {fiche!.partenaire && <span><Icon name="building" size={12} />{fiche!.partenaire}</span>}
                  </div>
                </div>
              ) : (
                <span class="hint" style="flex:1">
                  {ficheState === 'error' ? 'Lecture impossible — recharge la page Salesforce.' : page === 'other' ? 'Pas de fiche patient sur cette page.' : 'Fiche vide — clique ↻ une fois la page chargée.'}
                </span>
              )}
              <div class="row" style="gap:4px">
                {page === 'opportunity' && hasFiche && (
                  <Btn kind="soft" icon="message" title="Ouvrir les SMS (Hearo) et chercher ce patient" onClick={onSms} busy={busy === 'sms'} />
                )}
                <Btn kind="ghost" icon="refresh" title="Relire la fiche" onClick={onRefresh} busy={ficheState === 'loading'} />
              </div>
            </div>

            {page !== 'opportunity' && (
              <div class="actions mv-ligne">
                <BoutonNonJoignable big busy={busy === 'nonjoignable'} onConfirm={() => onMv('non-joignable')} />
                <Btn big icon="phone-off" busy={busy === 'mv'} onClick={() => onMv()} title="Écrit le commentaire MV, enregistre, puis clique « Piste non joignable »">
                  Message vocal → non joignable
                </Btn>
              </div>
            )}
            <div class="actions" style="margin-top:8px">
              {page !== 'opportunity' && (
                <>
                  <Btn kind="soft" icon="stetho" onClick={() => goTo('anamnese')}>COSI</Btn>
                  <Btn kind="soft" icon="pen" onClick={() => goTo('commentaire')}>Anamnèse</Btn>
                </>
              )}
              {page !== 'lead' && <Btn kind="soft" icon="mail" onClick={() => goTo('mails')}>Mail</Btn>}
              {page !== 'lead' && <Btn kind="soft" icon="message" onClick={() => goTo('chat')}>Chat partenaire</Btn>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
