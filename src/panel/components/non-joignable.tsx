import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './ui';

const DUREE_CONFIRMATION_MS = 4000;
/** Un double-clic ne confirme pas dans la foulée. */
const DELAI_AVANT_CONFIRMATION_MS = 400;

/**
 * « Piste non joignable » seul, sans commentaire (demande de Benjamin, 26/10), juste à gauche du MV.
 * En deux temps comme `DeleteBtn` : « Non joignable », puis « Confirmer ? » pendant 4 s.
 */
export function BoutonNonJoignable({ busy, big, onConfirm }: { busy: boolean; big?: boolean; onConfirm: () => void }) {
  const [arme, setArme] = useState(false);
  const armeLe = useRef(0);
  useEffect(() => {
    if (!arme) return;
    const t = setTimeout(() => setArme(false), DUREE_CONFIRMATION_MS);
    return () => clearTimeout(t);
  }, [arme]);

  const clic = () => {
    if (!arme) { armeLe.current = Date.now(); setArme(true); return; }
    if (Date.now() - armeLe.current < DELAI_AVANT_CONFIRMATION_MS) return;
    setArme(false);
    onConfirm();
  };

  return (
    <button type="button" class={['btn', big ? 'big' : '', 'non-joignable', arme ? 'arme' : ''].join(' ')} disabled={busy} onClick={clic}
      title={arme ? 'Clique encore : « Piste non joignable » dans Salesforce, sans écrire de commentaire' : 'Clique « Piste non joignable » dans Salesforce, sans écrire de commentaire (en deux temps)'}>
      {busy ? <span class="spin" /> : <Icon name={arme ? 'alert' : 'phone-off'} />}
      {arme ? 'Confirmer ?' : 'Non joignable'}
    </button>
  );
}
