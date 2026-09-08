import type { ActionResult, Fiche, PatientData, SfContext } from './types';

/** Change à chaque build : un script de page d'une autre version est remplacé par le panneau. */
export const CONTENT_VERSION: string = __COCKPIT_BUILD__;
export const PORT_NAME = 'cockpit-context';

/** Panneau → script de contenu (chrome.tabs.sendMessage). */
export type ContentRequest =
  | { type: 'ping' }
  | { type: 'getContext' }
  | { type: 'readFiche'; withPartner: boolean }
  | { type: 'runMv'; comment: string }
  | { type: 'fillAnamnese'; picklists: { label: string; value: string }[]; texts: { label: string; value: string }[] }
  | { type: 'writeComment'; text: string; save: boolean }
  | { type: 'writeChatPartenaire'; text: string }
  | { type: 'openSms' }
  | { type: 'fillSmsSearch'; text: string }
  | { type: 'diagSms' }
  | { type: 'openComposer' }
  | { type: 'insertMail'; subject: string; html: string }
  | { type: 'pastePatient'; data: PatientData; note: string };

export type ContentResponse =
  | { type: 'pong'; version: string; site: 'salesforce' | 'doctolib' | 'acuitis' }
  | { type: 'context'; context: SfContext }
  | { type: 'fiche'; fiche: Fiche }
  | { type: 'result'; result: ActionResult };

/** Script de contenu → panneau (port). */
export type ContextPush = { type: 'contextChanged'; context: SfContext };

/** Service worker → script de contenu / panneau. */
export type BackgroundMessage = { type: 'command'; command: 'run-mv' };
