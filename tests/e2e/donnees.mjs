// Données de test communes (banc d'essai et captures).
export const MODELES = [
  { id: 'tpl-rdv', title: 'Confirmation de RDV', audience: 'patient', type: 'email', patientCategory: 'Reconfirmation', subject: 'Votre rendez-vous du {{date}}', body: 'Bonjour {{nom}},\nVotre rendez-vous est confirmé le {{date}} à {{heure}}.\nBien à vous,\n{{nom_conseiller}}', smsCompanion: 'Bonjour, RDV le {{date}} à {{heure}}. {{nom_conseiller}}' },
  { id: 'tpl-cc1', title: 'Relance CC1', audience: 'patient', type: 'email', patientCategory: 'CC1', subject: 'Suite à notre échange', body: 'Bonjour {{nom}},\nJe reviens vers vous.\n{{nom_conseiller}}' },
  { id: 'tpl-sms', title: 'SMS rappel', audience: 'patient', type: 'sms', patientCategory: 'all', body: 'Bonjour {{nom}}, pensez à votre RDV. {{nom_conseiller}}' },
  { id: 'tpl-part', title: 'Nouveau patient partenaire', audience: 'partenaire', type: 'email', partnerCategory: 'CC1', subject: 'Patient pour {{nom partenaire}}', body: 'Bonjour {{nom partenaire}},\nJe vous adresse {{nom}}.\n{{adresse}}\nCordialement,\n{{nom_conseiller}}' },
];

export function donneesTest(extra = {}) {
  return {
    version: 2,
    onboardingDone: true,
    updatedAt: 1,
    reglages: { nom: 'Benjamin Test', telephone: '06 00 00 00 00', email: 'benjamin@test.fr', genre: 'M', mvComment: 'MV', autoSaveComment: true, emailFooter: 'Pied de page test', sigPatientMail: '', sigPatientSMS: '', sigPartenaireMail: '' },
    anamnese: {
      situations: [{ id: 'depistage_simple', label: 'Dépistage' }, { id: 'premier_rdv', label: '1er RDV' }],
      textes: { depistage_simple: 'Cher partenaire, je vous confie notre patient(e) pour un dépistage.\n\n{{resume}}\n\nBien à vous,\n{{nom_conseiller}}', premier_rdv: 'Premier RDV pour notre patient(e).\n\n{{resume}}\n\n{{nom_conseiller}}' },
      phrases: {},
    },
    chatPartenaire: [{ id: 'chat-merci', label: 'Merci', text: 'Bonjour,\nMerci pour cette mise à jour.\n{{nom_conseiller}}' }, { id: 'chat-relance', label: 'Relance', text: 'Bonjour, avez-vous des nouvelles de notre patient(e) ?' }],
    // Une copie par appel : un test qui retouche un modèle (60-cosi-anamnese) ne doit pas le changer pour les suivants.
    templates: MODELES.map((t) => ({ ...t })),
    categories: { patient: [{ id: 'Reconfirmation', label: 'Reconfirmation' }, { id: 'CC1', label: 'CC1' }], partenaire: [{ id: 'CC1', label: 'CC1' }, { id: 'CC2', label: 'CC2' }], seeded: true },
    ventes: { settings: { primeCat1: 40, primeCat2: 80, salaireBase: 0, indemnites: 0, cotFallback: 0.21, pasFallback: 0.099, retenuesFallback: 0, tauxImposition: 9.9 }, payslips: [], sales: { '2026-09': [{ name: 'Vente gardée', cat: 1 }] } },
    ...extra,
  };
}

