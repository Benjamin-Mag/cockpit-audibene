/**
 * Champs de l'onglet Anamnèse d'une Piste Salesforce. Le formulaire est identique
 * pour toutes les fiches : la liste est figée ici plutôt que rescannée.
 * `label` = libellé exact du champ sur la page (sert à le retrouver).
 */
export interface AnamField {
  label: string;
  displayLabel?: string;
  section: string;
  options?: string[];
  freeText?: boolean;
}

export const SITUATION_OPTIONS = ['Musique', 'Conversations de groupe', 'Loisirs', 'Télévision', 'Travail', 'Restaurant', 'Téléphone'];

export const FIELDS_CATALOG: AnamField[] = [
  { label: 'Civilité', section: 'Informations client', options: ['M.', 'Mme'] },
  { label: "Type d'appareillage", section: "Détails par rapport à l'appareillage", options: ['Premier appareillage', "Renouvellement d'appareillage"] },
  { label: 'Situation très importante 1', displayLabel: 'Situation 1', section: 'Analyse des besoins auditifs', options: SITUATION_OPTIONS },
  { label: 'Situation très importante 2', displayLabel: 'Situation 2', section: 'Analyse des besoins auditifs', options: SITUATION_OPTIONS },
  { label: 'Loisirs', section: 'Analyse des besoins auditifs', freeText: true },
  { label: 'Mots du client qui confirment motivation', displayLabel: 'Mots du client (motivation)', section: 'Analyse des besoins auditifs', freeText: true },
  { label: 'Statut professionnel', section: 'Analyse des besoins auditifs', options: ['Actif/ active', 'Retraité/e', 'Inconnu'] },
  { label: '(Ancienne) profession', displayLabel: 'Profession (ancienne)', section: 'Analyse des besoins auditifs', freeText: true },
  { label: 'Exposition aux nuisances sonores', section: 'Analyse des besoins auditifs', options: ['Oui', 'Non'] },
  { label: "Type d'appareil préféré", section: 'Attentes du client', options: ['BTE', 'Intra-auriculaire', 'RIC'] },
  { label: 'Design discret', section: 'Attentes du client', options: ['Moins important', 'Important', 'Très important'] },
  { label: 'Perte auditive fluctuante', section: 'Antécédents médicaux', options: ['Oui', 'Non'] },
  { label: "Opération à l'oreille", section: 'Antécédents médicaux', options: ['Oui', 'Non'] },
  { label: 'Otite', section: 'Antécédents médicaux', options: ['Oui', 'Non'] },
  { label: 'Surdité brusque', section: 'Antécédents médicaux', options: ['Oui', 'Non'] },
  { label: 'Acouphènes', section: 'Antécédents médicaux', options: ['Non', 'Les deux oreilles', 'Oreille gauche', 'Oreille droite'] },
  { label: 'Mutuelle', section: 'Coordonnées client', options: ['Yes', 'No'] },
];

/** Champs affichés sous "Type d'appareillage" selon la valeur choisie. */
export const CONDITIONAL_FIELDS: Record<string, AnamField[]> = {
  'Premier appareillage': [
    { label: 'Perte auditive', section: '', options: ['Binaurale', 'Monaurale gauche', 'Monaurale droite'] },
    { label: "Problèmes d'audition depuis quand?", displayLabel: 'Problèmes depuis', section: '', options: ['Plus de 5 ans', 'Moins de 6 mois', 'Plus de 6 mois'] },
    { label: 'Test auditif récent?', displayLabel: 'Test auditif récent', section: '', options: ['Oui', 'Non'] },
    { label: 'Test auditif récent - où ?', displayLabel: 'Test récent — où', section: '', options: ['ORL', 'Audioprothésiste', 'Non renseigné', 'Généraliste', 'Médecine de travail'] },
    { label: 'Ordonnance', section: '', options: ['Oui', 'Non', "Oui, mais elle a plus d'un an"] },
  ],
  "Renouvellement d'appareillage": [
    { label: "Age de l'aide auditive actuelle", displayLabel: 'Âge de l\'aide actuelle', section: '', options: ['1', '2', '3', '4+'] },
    { label: "Type d'aide auditive actuelle", displayLabel: 'Type actuel', section: '', options: ['Intra-auriculaire', 'Contour (BTE)', 'RIC'] },
    { label: "Satisfaction à l'égard des AA actuelles", displayLabel: 'Satisfaction actuelle', section: '', options: ['Pas satisfait', 'Satisfait', 'Très satisfait'] },
  ],
};

/** Champ commentaire texte et champ COSI associés à chaque Situation. */
export const SITUATION_COMMENT_FIELD: Record<string, string> = {
  'Situation très importante 1': 'Situation 1 - commentaires',
  'Situation très importante 2': 'Situation 2 - commentaires',
};
export const SITUATION_COSI_FIELD: Record<string, string> = {
  'Situation très importante 1': "COSI 1 - évaluation: l'intensité!",
  'Situation très importante 2': "COSI 2 - évaluation: l'intensité!",
};
