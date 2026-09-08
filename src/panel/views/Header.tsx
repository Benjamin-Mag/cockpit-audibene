import type { Site } from '../bridge';
import type { Fiche, SfContext } from '../../shared/types';
import { Btn, Icon } from '../components/ui';

interface Props {
  site: Site;
  ctx: SfContext | null;
  fiche: Fiche | null;
  ficheState: 'idle' | 'loading' | 'error';
  busy: string | null;
  onMv: () => void;
  onRefresh: () => void;
  goTo: (tab: 'anamnese' | 'commentaire' | 'mails' | 'ventes') => void;
}

export function Header({ site, ctx, fiche, ficheState, busy, onMv, onRefresh, goTo }: Props) {
  const page = ctx?.page ?? 'other';
  const connected = site === 'salesforce' && page !== 'other';

  return (
    <div class="top">
      <div class="brand">
        <span class={['dot', connected ? 'on' : ''].join(' ')} />
        <b>Cockpit</b>
        <span>{site === 'salesforce' ? 'Salesforce' : site === 'doctolib' ? 'Doctolib' : site === 'acuitis' ? 'Acuitis' : 'en attente'}</span>
      </div>

      <div class="card">
        {site !== 'salesforce' && <div class="fiche"><span class="hint">Ouvre une fiche Salesforce : les infos et les actions apparaissent ici.</span></div>}
        {site === 'salesforce' && page === 'other' && <div class="fiche"><span class="hint">Ouvre une Piste ou une Opportunité pour commencer.</span></div>}

        {connected && (
          <div class="fiche">
            <div class="fiche-head">
              {ficheState === 'loading' || !fiche ? (
                <div class="stack" style="flex:1;gap:7px">
                  <div class="skeleton" style="width:60%;height:15px" />
                  <div class="skeleton" style="width:85%" />
                </div>
              ) : (
                <div class="stack" style="gap:3px;flex:1">
                  <div class="name">
                    {fiche.genre === 'F' ? 'Mme' : fiche.genre === 'M' ? 'M.' : ''} {fiche.prenom} {fiche.nom}
                    <span class="tag">{page === 'lead' ? 'Piste' : 'Opportunité'}</span>
                  </div>
                  <div class="meta">
                    {fiche.telephone && <span>{fiche.telephone}</span>}
                    {fiche.naissance && <span><Icon name="calendar" size={12} />{fiche.naissance}</span>}
                    {fiche.email && <span>{fiche.email}</span>}
                    {fiche.partenaire && <span><Icon name="building" size={12} />{fiche.partenaire}</span>}
                  </div>
                  {ficheState === 'error' && <span class="note warn">Lecture impossible — recharge la page.</span>}
                </div>
              )}
              <Btn kind="ghost" icon="refresh" title="Relire la fiche" onClick={onRefresh} busy={ficheState === 'loading'} />
            </div>

            <div class="actions">
              {page === 'lead' && (
                <>
                  <Btn icon="phone-off" busy={busy === 'mv'} onClick={onMv} title="Commentaire + Enregistrer + Piste non joignable">MV non joignable</Btn>
                  <Btn kind="soft" icon="stetho" onClick={() => goTo('anamnese')}>Anamnèse</Btn>
                  <Btn kind="soft" icon="pen" onClick={() => goTo('commentaire')}>Commentaire</Btn>
                  <Btn kind="ghost" icon="mail" onClick={() => goTo('mails')} title="Étape 2">Mail</Btn>
                </>
              )}
              {page === 'opportunity' && (
                <>
                  <Btn kind="soft" icon="mail" onClick={() => goTo('mails')} title="Étape 2">Mail</Btn>
                  <Btn kind="ghost" icon="coins" onClick={() => goTo('ventes')} title="Étape 3">Ajouter la vente</Btn>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
