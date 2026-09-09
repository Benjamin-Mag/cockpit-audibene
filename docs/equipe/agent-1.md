# Agent 1 — journal

Session : `Agent 1` (`77104a`). Chef d'orchestre : `projects-b4` (`72f84a`).
Worktree : `Documents\Claude\Projects\Cockpit Audibene - partner-search` · branche `feature/partner-search`.

## Chantier : Partner Search
Objectif (cadrage à venir avec Benjamin) : reproduire dans Cockpit le « Partner Search » natif de Salesforce — afficher les partenaires audioprothésistes **les plus proches du code postal de la Piste ouverte**, à partir d'un rapport Salesforce que Benjamin mettra à disposition. Les détails (source des données, présentation, actions attendues) seront communiqués par le chef d'orchestre.

## À faire pour démarrer (introduction)
- [x] Lire `CLAUDE.md`, `docs/equipe/EQUIPE.md`, ce fichier.
- [x] Dans le worktree : `npm ci`, `npx tsc --noEmit`, `npm run build` → OK (build 20260909101850, `dist/` produit, branche à jour sur `origin/main` f705c0f).
- [x] Charger `dist/` du worktree dans Edge — **délégué au chef d'orchestre / Benjamin** (test réel à chaque livraison). De mon côté : `npm run dev` → http://localhost:5173/panel.html pour vérifier l'interface sans Salesforce.
- [x] Repérer dans le code : lecture de la fiche (`src/content/salesforce/context.ts`), onglets par type de fiche (`src/panel/app.tsx`), une action de bout en bout (ex. `openSmsPanel` → `bridge.ts` → `Header.tsx`).
- [x] Envoyer un message au chef d'orchestre : « prêt », plus toute question sur la mise en place.

## Ce que j'ai compris du code (repères pour le chantier)
- **Lecture de la fiche** : `readFiche(withPartner)` dans `src/content/salesforce/context.ts` lit nom, genre, téléphone, e-mail, naissance via `fieldValue(label)` (libellés Lightning, `visibleEl` obligatoire), et le partenaire + son adresse via le panneau de survol du lien Account. **Le code postal du patient n'est pas lu aujourd'hui** : ni dans `Fiche` (`src/shared/types.ts`) ni dans `readFiche`. Il faudra l'ajouter (champ `codePostal` dans `Fiche`, lecture par libellé de l'adresse de la Piste — libellé exact à confirmer sur une vraie Piste).
- **Onglets selon la fiche** : `src/panel/app.tsx` → tableau `TABS` + `hidden` (Piste : cache Mails/Chat ; Opportunité : cache COSI/Anamnèse). Un onglet « Partenaires » se branche là, visible sur Piste (et peut-être Opportunité).
- **Action de bout en bout** : `Header.tsx` (bouton) → `app.tsx` (`openSms`) → `bridge.ts` (`runAction`/`send` avec `ensureContent` + ping/injection) → `chrome.tabs.sendMessage` → `src/content/salesforce/index.ts` (`handle`, switch sur `req.type`) → `actions.ts` (`openSmsPanel`). Nouvelle action = type dans `messages.ts` + cas dans `index.ts` + fonction dans `actions.ts`.
- **Shadow DOM** : `dom.ts` → `deepAll`/`deepFirst` (`.shadowRoot` d'abord, puis `chrome.dom.openOrClosedShadowRoot`), `visibleEl` (dernier candidat rendu, jamais un invisible), `waitFor`, `setNativeValue`, `fieldValue`, `expandSection`.
- **Données** : `AppData` dans `src/panel/model.ts`, valeurs par défaut `defaultData()`, `normalize` + `mergeData` dans `storage/legacy.ts`, stockage `chrome.storage.local` + `cockpit.json` (dossier synchronisé). Import de fichier : `pickJsonFile` dans `storage/fs.ts` (JSON seulement pour l'instant). Le rapport partenaires (liste + code postal, probablement CSV/Excel exporté de Salesforce) devra soit être converti en JSON, soit lu en CSV — à décider au cadrage.
- **UI** : `components/ui.tsx` (`Btn`, `Chip`, `Seg`, `Field`, `DeleteBtn`, `EditablePreview`, `Toast`) ; palette et durées dans `src/panel/styles.css` (`--accent #1b4f9b`, `--dur 280ms`, `--dur-slow 440ms`).

## Journal
- 2026-09-09 : introduction au projet. Lecture des docs, vérifications (`tsc`, `build`) vertes, repérage du code. Message « prêt » envoyé au chef.
- 2026-09-09 : introduction validée par le chef. Tests Salesforce délégués au chef/Benjamin ; export CSV privilégié si le rapport est un Excel ; aucune lib sans validation. En attente du cadrage Partner Search.

## Décisions
(néant)

## Questions ouvertes
- Format du rapport Salesforce partenaires (CSV ? Excel ? colonnes : nom, adresse, code postal, ville, téléphone, coordonnées GPS ?) : à préciser au cadrage. « Le plus proche » = même département / préfixe de code postal, ou vraie distance (nécessite latitude/longitude ou une table code postal → coordonnées embarquée, sans appel réseau) ?
