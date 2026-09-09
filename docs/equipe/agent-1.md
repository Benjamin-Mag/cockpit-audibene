# Agent 1 — journal

Session : `Agent 1` (`77104a`). Chef d'orchestre : `projects-b4` (`72f84a`).
Worktree : `Documents\Claude\Projects\Cockpit Audibene - partner-search` · branche `feature/partner-search`.

## Chantier : Partner Search (cadrage du 2026-09-09, validé par Benjamin)

**Objectif** : sur une **Piste** ouverte, voir sans aucun clic les **5 partenaires audioprothésistes les plus proches** du code postal du patient, avec une **carte Google Maps** intégrée (itinéraire adresse patient → partenaire choisi) pour décider lequel convient.

**Source** : rapport Salesforce « FRA Partenaires Actifs », id `00O3V000000rs59UAA` (~1 213 lignes). Colonnes : ID du compte · Nom du compte · Compte principal · Code postal de facturation · Statut · Partenaire depuis · e-mail · cote du compte · Point of Sale Address (3 lignes : rue / `05000 Gap` / région + pays) · Rémunération partenaire · ID Client Navision · Remise WSA · Propriétaire du compte. Pas de téléphone. Statut « Actif » gardé en priorité ; les autres exclus par défaut (interrupteur « inclure les désactivés » si simple).

**Lecture du rapport** (méthode de `SMS/sf-rdv-stats-extension/panel.js`, lecture seule) : permission `cookies` → `chrome.cookies.get({ url: 'https://betterhearing.my.salesforce.com', name: 'sid' })` → `GET /services/data/v62.0/analytics/reports/<id>?includeDetails=true` avec `Authorization: Bearer <sid>` → colonnes `reportMetadata.detailColumns` (+ libellés dans `reportExtendedMetadata.detailColumnInfo`), lignes `factMap[*].rows[].dataCells[].label`. **Cache 24 h obligatoire** (quota Salesforce : 500 exécutions/heure) dans `AppData.partenaires { fetchedAt, items[] }`, bouton « Actualiser » ; en cas d'erreur, garder la dernière liste et afficher un message discret. Seule exception (avec la carte Google) à la règle « pas d'appel réseau ». Repli SOQL à garder en tête, pas à implémenter.

**Proximité, 100 % local** : table code postal → lat/long France (base officielle, licence ouverte) générée une fois par un script dans `scripts/` (téléchargement au build, pas à l'exécution) vers un JSON compact (3 décimales, < 1 Mo), chargé par import dynamique. Haversine entre le centroïde du code postal de la Piste (`Fiche.codePostal`) et celui de chaque partenaire ; trier, garder 5. Code postal inconnu → repli département (2 chiffres) puis message. Afficher : nom, adresse complète, distance (km), statut si non « Actif ».

**Carte et adresse** : champ « Adresse du patient » prérempli `codePostal + ville`, modifiable, mémorisé le temps de la fiche. Clic sur un partenaire → iframe `https://maps.google.com/maps?saddr=…&daddr=…&output=embed` (sans clé) + bouton « Ouvrir dans Google Maps » (`https://www.google.com/maps/dir/?api=1&origin=…&destination=…`, nouvel onglet). L'adresse patient ne part vers Google qu'après le clic sur un partenaire (accepté par Benjamin). Actions : « Ouvrir la fiche Salesforce » (`/lightning/r/Account/<id>/view`), « Copier l'adresse ».

**Emplacement** : onglet **« Partenaires »** visible sur une Piste, masqué sur Opportunité (`TABS` + `hidden` dans `app.tsx`), vue `src/panel/views/Partenaires.tsx`, composants existants, palette et animations en place, textes en français. Bouton « Actualiser » discret avec date de dernière lecture.

**Contraintes** : `partenaires` dans `defaultData`, `normalize`, `mergeData` (union par ID, `fetchedAt` le plus récent), jamais dans « Partager mes modèles ». `chrome.cookies` depuis le panneau, pas le script de contenu. Pas de dépendance npm sans accord. `tsc` vert + `build` OK avant livraison ; PR sur `main` + message de session.

**Découpage** (une PR par étape) :
1. **Données** — permission cookies, lecture du rapport, normalisation, cache 24 h + Actualiser, stockage `AppData`, onglet Partenaires minimal (liste brute + date). → **livré, PR #2** (voir journal).
2. **Proximité** — table code postal → coordonnées, calcul, 5 plus proches avec distance, exclusion des non actifs.
3. **Carte** — adresse patient, iframe Google Maps, bouton Ouvrir, actions par partenaire.

## À faire pour démarrer (introduction)
- [x] Lire `CLAUDE.md`, `docs/equipe/EQUIPE.md`, ce fichier.
- [x] Dans le worktree : `npm ci`, `npx tsc --noEmit`, `npm run build` → OK (build 20260909101850, `dist/` produit, branche à jour sur `origin/main` f705c0f).
- [x] Charger `dist/` du worktree dans Edge — **délégué au chef d'orchestre / Benjamin** (test réel à chaque livraison). De mon côté : `npm run dev` → http://localhost:5173/panel.html pour vérifier l'interface sans Salesforce.
- [x] Repérer dans le code : lecture de la fiche (`src/content/salesforce/context.ts`), onglets par type de fiche (`src/panel/app.tsx`), une action de bout en bout (ex. `openSmsPanel` → `bridge.ts` → `Header.tsx`).
- [x] Envoyer un message au chef d'orchestre : « prêt », plus toute question sur la mise en place.

## Ce que j'ai compris du code (repères pour le chantier)
- **Lecture de la fiche** : `readFiche(withPartner)` dans `src/content/salesforce/context.ts` lit nom, genre, téléphone, e-mail, naissance via `fieldValue(label)` (libellés Lightning, `visibleEl` obligatoire), et le partenaire + son adresse via le panneau de survol du lien Account. **Code postal et ville** : depuis v1.0.19 (PR #1 du chef), `Fiche` expose `codePostal` et `ville`, lus par `codePostalEtVille()` dans `context.ts` (champ « Adresse » de la Piste, ex. « 33510 ANDERNOS LES BAINS », repli sur le titre de l'Opportunité) et affichés dans `Header.tsx` (icône `pin`). Partner Search partira de `fiche.codePostal`.
- **Onglets selon la fiche** : `src/panel/app.tsx` → tableau `TABS` + `hidden` (Piste : cache Mails/Chat ; Opportunité : cache COSI/Anamnèse). Un onglet « Partenaires » se branche là, visible sur Piste (et peut-être Opportunité).
- **Action de bout en bout** : `Header.tsx` (bouton) → `app.tsx` (`openSms`) → `bridge.ts` (`runAction`/`send` avec `ensureContent` + ping/injection) → `chrome.tabs.sendMessage` → `src/content/salesforce/index.ts` (`handle`, switch sur `req.type`) → `actions.ts` (`openSmsPanel`). Nouvelle action = type dans `messages.ts` + cas dans `index.ts` + fonction dans `actions.ts`.
- **Shadow DOM** : `dom.ts` → `deepAll`/`deepFirst` (`.shadowRoot` d'abord, puis `chrome.dom.openOrClosedShadowRoot`), `visibleEl` (dernier candidat rendu, jamais un invisible), `waitFor`, `setNativeValue`, `fieldValue`, `expandSection`.
- **Données** : `AppData` dans `src/panel/model.ts`, valeurs par défaut `defaultData()`, `normalize` + `mergeData` dans `storage/legacy.ts`, stockage `chrome.storage.local` + `cockpit.json` (dossier synchronisé). Import de fichier : `pickJsonFile` dans `storage/fs.ts` (JSON seulement pour l'instant). Le rapport partenaires (liste + code postal, probablement CSV/Excel exporté de Salesforce) devra soit être converti en JSON, soit lu en CSV — à décider au cadrage.
- **UI** : `components/ui.tsx` (`Btn`, `Chip`, `Seg`, `Field`, `DeleteBtn`, `EditablePreview`, `Toast`) ; palette et durées dans `src/panel/styles.css` (`--accent #1b4f9b`, `--dur 280ms`, `--dur-slow 440ms`).

## Journal
- 2026-09-09 : introduction au projet. Lecture des docs, vérifications (`tsc`, `build`) vertes, repérage du code. Message « prêt » envoyé au chef.
- 2026-09-09 : introduction validée par le chef. Tests Salesforce délégués au chef/Benjamin ; export CSV privilégié si le rapport est un Excel ; aucune lib sans validation. En attente du cadrage Partner Search.
- 2026-09-09 : branche rebasée sur `origin/main` (v1.0.19, code postal + ville lus sur la fiche). `tsc` vert. Toujours en attente du cadrage.
- 2026-09-09 : cadrage reçu (recopié ci-dessus). **Étape 1 livrée : PR #2** (commit 6f76968) — permission `cookies`, `src/panel/partenaires.ts` (lecture + parseur), `AppData.partenaires`, `views/Partenaires.tsx`, onglet dans `app.tsx`. Parseur testé sur un faux rapport (Node) ; interface vérifiée en mode web (`npm run dev`) avec des données injectées. Reste à confirmer la forme réelle de la réponse Salesforce au premier test du chef.

## Reste à faire
- Étape 2 : script `scripts/` code postal → lat/long (data.gouv), JSON compact chargé à la demande, haversine, 5 plus proches, exclusion des non actifs + interrupteur.
- Étape 3 : adresse patient préremplie, iframe Google Maps, « Ouvrir dans Google Maps », « Ouvrir la fiche Salesforce », « Copier l'adresse ».

## Décisions
- Colonnes du rapport repérées par **libellé** (`detailColumnInfo[api].label`, regex tolérantes FR/EN), jamais par position : l'ordre du rapport peut changer.
- Lignes lues dans **toutes** les clés du `factMap` avec dédoublonnage par ID : marche pour un rapport tabulaire (`T!T`) comme pour un rapport groupé.
- Adresse : `value` objet `{street, postalCode, city}` si Salesforce le fournit, sinon découpage du texte (ligne `05000 Gap`, région/pays ignorés) ; repli sur « Code postal de facturation ».
- Étape 1 : tous les statuts affichés (badge si ≠ « Actif ») ; l'exclusion par défaut arrive avec la proximité (étape 2).
- Onglet Partenaires visible aussi sur les pages Salesforce sans fiche (hypothèse la plus simple ; à arbitrer, voir Questions).
- Cache stocké dans `AppData` (donc `cockpit.json` si dossier synchronisé) pour suivre la règle « nouvelle donnée = AppData ».

## Questions ouvertes
- Onglet Partenaires hors Piste : le garder (6 onglets serrés sur une page sans fiche) ou le masquer ?
- Cache dans `cockpit.json` (≈ 250 Ko) : OK, ou navigateur seul ?
- Format du rapport Salesforce partenaires (CSV ? Excel ? colonnes : nom, adresse, code postal, ville, téléphone, coordonnées GPS ?) : à préciser au cadrage. « Le plus proche » = même département / préfixe de code postal, ou vraie distance (nécessite latitude/longitude ou une table code postal → coordonnées embarquée, sans appel réseau) ?
