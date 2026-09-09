export type SfPage = 'lead' | 'opportunity' | 'other';
export type Genre = 'M' | 'F' | null;

/** Infos lues sur la fiche Salesforce courante. */
export interface Fiche {
  page: SfPage;
  recordId: string;
  genre: Genre;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  naissance: string;
  /** Code postal et ville du patient (champ Adresse de la Piste, ou titre de l'Opportunité). */
  codePostal: string;
  ville: string;
  partenaire: string;
  adresse: string;
}

/** État léger de la page, poussé par le script de contenu à chaque changement. */
export interface SfContext {
  page: SfPage;
  recordId: string;
  composerOpen: boolean;
  url: string;
}

export interface StepResult {
  ok: boolean;
  msg: string;
}

export interface ActionResult {
  ok: boolean;
  msg: string;
  steps?: StepResult[];
}

/** Données patient envoyées aux formulaires Doctolib / Acuitis. */
export interface PatientData {
  genre: Genre;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  naissance: string;
}

/** Fiche lue récemment, mémorisée pour être collée sur Doctolib / Acuitis. */
export interface RecentPatient extends PatientData {
  recordId: string;
  savedAt: number;
}
