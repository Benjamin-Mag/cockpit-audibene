import type { ActionResult, Fiche, MailRecipient, PartenaireSF, PatientData, SfContext } from './types';

/** Change à chaque build : un script de page d'une autre version est remplacé par le panneau. */
export const CONTENT_VERSION: string = __COCKPIT_BUILD__;
export const PORT_NAME = 'cockpit-context';

/** Panneau → script de contenu (chrome.tabs.sendMessage). */
export type ContentRequest =
  | { type: 'ping' }
  | { type: 'getContext' }
  | { type: 'readFiche'; withPartner: boolean }
  | { type: 'runMv'; comment: string }
  /** « Piste non joignable » seul, sans commentaire. */
  | { type: 'runNonJoignable' }
  | { type: 'fillAnamnese'; picklists: { label: string; value: string }[]; texts: { label: string; value: string }[]; multis?: { label: string; values: string[] }[] }
  | { type: 'writeComment'; text: string; save: boolean }
  | { type: 'writeChatPartenaire'; text: string }
  | { type: 'openSms' }
  | { type: 'fillSmsSearch'; text: string }
  | { type: 'diagSms' }
  | { type: 'openComposer' }
  | { type: 'insertMail'; subject: string; html: string; recipient?: MailRecipient }
  | { type: 'pastePatient'; data: PatientData; note: string }
  | { type: 'lirePartnerSearch' };

export type ContentResponse =
  | { type: 'pong'; version: string; site: 'salesforce' | 'doctolib' | 'acuitis' | 'grandaudition' }
  | { type: 'context'; context: SfContext }
  | { type: 'fiche'; fiche: Fiche }
  | { type: 'result'; result: ActionResult }
  | { type: 'partenaires'; ok: boolean; msg: string; partenaires: PartenaireSF[] };

/** Script de contenu → panneau (port). */
export type ContextPush = { type: 'contextChanged'; context: SfContext };

/** Service worker → script de contenu / panneau. */
export type BackgroundMessage = { type: 'command'; command: 'run-mv' };
