import { type Reglages, variablesVides } from '../model';

/** Sous un aperçu : ce qui manque dans les Réglages pour que le texte soit complet (sinon la ligne disparaît). */
export function VariablesVides({ texte, reglages }: { texte: string; reglages: Reglages }) {
  const vides = variablesVides(texte, reglages);
  if (!vides.length) return null;
  const liste = vides.length === 1 ? vides[0] : `${vides.slice(0, -1).join(', ')} et ${vides[vides.length - 1]}`;
  const pluriel = vides.length > 1;
  return (
    <div class="note vars-vides" role="status" style="color:var(--warn);background:var(--warn-soft);border-radius:var(--radius-sm);padding:6px 10px">
      ⚠ {liste.charAt(0).toUpperCase() + liste.slice(1)} {pluriel ? 'ne sont pas remplis' : 'n’est pas rempli'} dans Réglages (roue ⚙) : {pluriel ? 'ils manquent' : 'il manque'} dans ce texte.
    </div>
  );
}
