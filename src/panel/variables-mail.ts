/**
 * Ce que l'éditeur de modèle de mail propose d'insérer d'un clic, rangé par groupe, avec un exemple fictif en infobulle.
 * Ce sont toutes les variables que le remplissage sait résoudre (Mails.tsx : composeValues ; model.ts : systemValues)
 * et toutes les formes masculin / féminin de resolveGenre. Toute autre {{variable}} devient une case à remplir au
 * moment du mail. Cockpit Plein Écran résout les mêmes (src/plein/mails-modeles.ts). Pur.
 */

export interface VariableMail {
  /** Texte inséré dans le modèle. */
  snippet: string;
  /** Texte de la puce. */
  label: string;
  /** Infobulle : d'où vient la valeur, avec un exemple fictif. */
  aide: string;
}

export interface GroupeVariables { titre: string; variables: VariableMail[] }

/** Forme masculin / féminin reconnue par resolveGenre, et ce qu'elle donne pour M. et pour Mme. */
export interface FormeGenre {
  snippet: string;
  masculin: string;
  feminin: string;
  /** Terminaison à coller juste après un mot : l'exemple montre le mot entier. */
  exemple?: { texte: string; masculin: string; feminin: string };
}

export const FORMES_GENRE: FormeGenre[] = [
  { snippet: 'il(elle)', masculin: 'il', feminin: 'elle' },
  { snippet: "s'il(elle)", masculin: "s'il", feminin: 'si elle' },
  { snippet: 'le(la)', masculin: 'le', feminin: 'la' },
  { snippet: 'un(une)', masculin: 'un', feminin: 'une' },
  { snippet: 'du(de la)', masculin: 'du', feminin: 'de la' },
  { snippet: 'au(à la)', masculin: 'au', feminin: 'à la' },
  { snippet: 'cet(te)', masculin: 'cet', feminin: 'cette' },
  { snippet: 'patient(e)', masculin: 'patient', feminin: 'patiente' },
  { snippet: 'cher(ère)', masculin: 'cher', feminin: 'chère' },
  { snippet: 'premier(ère)', masculin: 'premier', feminin: 'première' },
  { snippet: 'conseiller(ère)', masculin: 'conseiller', feminin: 'conseillère' },
  { snippet: '(e)', masculin: '', feminin: 'e', exemple: { texte: 'intéressé(e)', masculin: 'intéressé', feminin: 'intéressée' } },
  { snippet: '(ère)', masculin: '', feminin: 'ère', exemple: { texte: 'dernier(ère)', masculin: 'dernier', feminin: 'dernière' } },
  { snippet: '(te)', masculin: '', feminin: 'te', exemple: { texte: 'muet(te)', masculin: 'muet', feminin: 'muette' } },
];

const varGenre = (f: FormeGenre): VariableMail => f.exemple
  ? { snippet: f.snippet, label: `…${f.snippet}`, aide: `À coller juste après un mot : ${f.exemple.texte} → M. « ${f.exemple.masculin} », Mme « ${f.exemple.feminin} »` }
  : { snippet: f.snippet, label: f.snippet, aide: `M. « ${f.masculin} », Mme « ${f.feminin} »${f.snippet === 'conseiller(ère)' ? ' — suit le genre du patient ; pour toi, prends « Conseiller/ère audibene »' : ''}` };

export const GROUPES_VARIABLES: GroupeVariables[] = [
  { titre: 'Patient', variables: [
    { snippet: '{{nom}}', label: 'Nom du patient', aide: 'Civilité, prénom et nom lus sur la fiche — ex. « Madame Alice Essai »' },
  ] },
  { titre: 'Date et heure du rendez-vous', variables: [
    { snippet: '{{date}}', label: 'Date du RDV', aide: 'Lue sur la fiche ouverte (champ du rendez-vous), sinon choisie au moment du mail — ex. « 12 novembre 2026 »' },
    { snippet: '{{heure}}', label: 'Heure du RDV', aide: 'Lue sur la fiche ouverte (champ du rendez-vous), sinon choisie au moment du mail — ex. « 14h30 »' },
  ] },
  { titre: 'Partenaire', variables: [
    { snippet: '{{nom partenaire}}', label: 'Nom du partenaire', aide: 'Lu sur la fiche — ex. « Centre Essai »' },
    { snippet: '{{adresse}}', label: 'Adresse du partenaire', aide: 'Adresse du centre lue sur la fiche, sur ses propres lignes — ex. « 1 place de l’Essai, 69000 Lyon »' },
  ] },
  { titre: 'Conseiller (toi)', variables: [
    { snippet: '{{nom_conseiller}}', label: 'Ton nom', aide: 'Réglages → Signature — ex. « Camille Essai »' },
    { snippet: '{{tel_conseiller}}', label: 'Ton téléphone', aide: 'Réglages → Signature — ex. « 06 00 00 00 00 »' },
    { snippet: '{{email_conseiller}}', label: 'Ton adresse mail', aide: 'Réglages → Signature — ex. « camille.essai@exemple.fr »' },
    { snippet: '{{titre_conseiller}}', label: 'Conseiller/ère audibene', aide: 'Selon ton genre dans les Réglages — ex. « Conseillère audibene »' },
  ] },
  { titre: 'Masculin / féminin (selon M. ou Mme du patient)', variables: FORMES_GENRE.map(varGenre) },
];
