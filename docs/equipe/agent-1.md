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

**Contraintes** : la liste des partenaires est un **cache navigateur** (`chrome.storage.local`, clé `partenairesCache`, repli `localStorage`), jamais dans `AppData` / `cockpit.json` / partage (décision du chef après relecture de la PR #2). `chrome.cookies` depuis le panneau, pas le script de contenu. Pas de dépendance npm sans accord. `tsc` vert + `build` OK avant livraison ; PR sur `main` + message de session. Une branche par étape, créée depuis `main` à jour.

**Découpage** (une PR par étape) :
1. **Données** — permission cookies, lecture du rapport, normalisation, cache 24 h + Actualiser, onglet Partenaires minimal (liste brute + date). → **mergé (PR #2 → #3 squash), publié en v1.0.20.**
2. **Proximité** — table code postal → coordonnées, calcul, 5 plus proches avec distance, exclusion des non actifs. → **en cours, branche `feature/partner-search-proximite`.**
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

- 2026-09-09 : relecture du chef sur la PR #2 → 3 ajustements poussés : cache `partenairesCache` dans `chrome.storage.local` (repli `localStorage`), hors `AppData` ; onglet Partenaires masqué hors Piste ; 50 lignes max sans filtre. `tsc` + `build` verts, parseur re-testé, onglet vérifié absent en mode web. Étape 2 → nouvelle branche `feature/partner-search-proximite` depuis `main` après merge.

- 2026-09-09 : PR #2 mergée par le chef (squash #3), **v1.0.20** publiée. Mon worktree avait été supprimé au merge : recréé sur `feature/partner-search-proximite` depuis `origin/main` (fa1acfd), `npm ci`, `tsc` vert.
- 2026-09-09 : **étape 2 codée** — `scripts/codes-postaux.mjs` (génère `public/data/codes-postaux.json`, rejouable, source + date en tête ; testé sur un mini CSV), `src/panel/geo.ts` (chargement de la table, `localiser` avec repli département, haversine, `plusProches` ; testé sous Node : Andernos → Arès 4 km, Bordeaux 44 km, Paris 527 km), vue Partenaires : bloc « Les plus proches de <CP ville> » (5, distance en km, désactivés exclus + case « inclure les désactivés »), messages si code postal absent / inconnu / table absente, liste complète repliée derrière « Toute la liste ». **Reste : générer la table réelle** (téléchargement de la base La Poste ≈ 1,5 Mo — en attente de l'accord de Benjamin, une autorisation du chef ne vaut pas pour un téléchargement), vérifier la taille du JSON (< 1 Mo visé), PR.

- **2026-09-09 : Partner Search abandonné, remplacé par ORL Finder (cadrage à venir).** Décision de Benjamin transmise par le chef. Pas de table des codes postaux générée, pas de PR pour l'étape 2. La branche `feature/partner-search-proximite` (commit d99ff29 : script codes postaux, `geo.ts` haversine + repli département, vue « plus proches ») est conservée telle quelle : ce code peut resservir pour ORL Finder (ORL proches du patient). L'onglet Partenaires de la v1.0.20 sera retiré ou remplacé selon le cadrage.

- 2026-09-09 : cadrage ORL Finder reçu (recopié ci-dessous). Branche `feature/orl-finder` depuis `main` (fa1acfd). **Accord de Benjamin dans ma session** pour télécharger une fois la base des codes postaux → le CSV data.gouv n'a plus de coordonnées ; script réécrit sur l'API Datanova de La Poste (même base, champ `_geopoint` = centroïde de commune, 4 pages de 10 000) → `public/data/codes-postaux.json` : 6 321 codes postaux, 143 Ko. Partner Search retiré, `doctolib.ts` + `views/OrlFinder.tsx` écrits (étape 1).

## Chantier : ORL Finder (cadrage du 2026-09-09, validé par Benjamin ; appels Doctolib vérifiés par le chef)

**Objectif** : sur une **Piste**, un onglet **ORL Finder** montre sans clic les ORL proches du patient (`Fiche.codePostal`) **avec leur prochain créneau Doctolib**, triés : secteur 1 d'abord, puis distance, puis délai. Par ORL : nom, secteur, adresse, distance, prochain RDV, **Prendre RDV** (Doctolib), **Itinéraire** (Google Maps depuis l'adresse du patient), **téléphone** (`tel:` + copier), **Audiométrie ✅ / ⚠️ à confirmer**, « Copier le message type ». Bloc **TOP 3 les plus rapides**. Filtres : délai 7/14/30 j, secteur (S1 / tous), rayon 20 km élargi automatiquement (40, 60) si aucun créneau. Recherche en arrière-plan + lien « Ouvrir sur Doctolib ». Règles : **pas de téléphone = pas de ligne** ; « à confirmer » pour ce qui n'est pas vérifié ; ne jamais inventer.

**Doctolib** (depuis le panneau, `fetch` + `credentials: 'include'`, host déjà autorisé) :
1. Recherche : `POST /patient-health-search/api/v1/hcp/search?page=N` JSON `{ keyword: "orl-oto-rhino-laryngologie", location: { gpsPoint: { lat, lng } }, filters?: { regulationSector: [...], availabilitiesBefore: 1|3|7|14 } }` → 206, 16 par page, triés par distance. Champs : `title/firstName/name`, `location {address, zipcode, city, lat, lng, distanceInMeters}`, `regulationSector` (`contracted_1` / `contracted_2` / null), `link` (RDV = doctolib.fr + link), `references.practiceId`, `matchedVisitMotive {visitMotiveId, agendaIds, name, allowNewPatients}`, `onlineBooking.agendaIds`. `location.place` → 422.
2. Créneau : `GET /search/availabilities.json?telehealth=false&limit=5&start_date_time=<ISO local avec décalage>&visit_motive_id=&agenda_ids=&practice_ids=` → `next_slot` ou null, `reason`. Séquentiel, ~150 ms.
3. Fiche : `GET /profiles/<slug>.json?pid=practice-<id>&locale=fr` → `data.places[] {landline_number, full_address}`, `data.details[] {practice_id, regulation_sector}`, `data.profile.skills_by_practice[pid][] {name}` (« Audiom » → ✅). Seulement pour les retenus (≤ 12).
4. GPS du code postal : ma table `geo.ts` (Datanova / La Poste). 5. Lien recherche : `/search?speciality=orl-oto-rhino-laryngologie&location=<cp>` (à vérifier). 6. Si 403 / anti-robot → prévenir le chef avant tout contournement (repli : script de contenu dans un onglet Doctolib `active:false`).

**Tri** : rayon 20 → 40 → 60 km ; groupes S1 → S2/OPTAM → non renseigné ; distance puis `next_slot` ; TOP 3 = 3 `next_slot` les plus proches (avec téléphone) ; une ligne par praticien **et par lieu** (dédoublonnage `references.id` + `practiceId`) ; sans téléphone après lecture de la fiche → masqué, compteur discret.

**Message type** : « Bonjour, je souhaite prendre rendez-vous pour un bilan auditif complet incluant une audiométrie tonale et vocale, dans le cadre d'un projet d'appareillage. Pouvez-vous me confirmer que ce bilan est bien réalisé dans votre cabinet ? Merci. »

**Adresse patient** préremplie `codePostal + ville`, modifiable ; itinéraire `https://www.google.com/maps/dir/?api=1&origin=…&destination=…` en nouvel onglet ; rien n'est envoyé avant le clic.

**Code** : retirer Partner Search (`partenaires.ts`, `views/Partenaires.tsx`, onglet, permission `cookies`) ; nouveaux `src/panel/doctolib.ts`, `src/panel/views/OrlFinder.tsx`, onglet `orl` « ORL Finder » (icône oreille) **uniquement sur Piste** ; cache résultats 10 min en mémoire ; déclenchement automatique ; progression « 12 ORL trouvés, lecture des créneaux… 4/12 ». Pas de dépendance.

**Découpage** (branche `feature/orl-finder` depuis `main`, une PR par étape) :
1. Retrait Partner Search + onglet ORL Finder : recherche GPS, liste triée avec distance, prochain créneau, Prendre RDV / Itinéraire / Ouvrir sur Doctolib (téléphone « à l'étape suivante »). → **livré, PR #4** (parseur validé sur une vraie réponse Doctolib depuis Node ; à confirmer depuis le panneau).
2. Fiche praticien : téléphone (pas de téléphone = pas de ligne), secteur en clair, Audiométrie, message type, TOP 3. → **livré, PR #6**, branche `feature/orl-finder-2`.
3. Filtres (délai, secteur, rayon auto), cache 10 min, finitions.

- 2026-09-09 : PR #4 mergée (squash #5), **v1.0.21** publiée. Worktree recréé sur `feature/orl-finder-2` depuis `main` (5d38336). Étape 2 : `ficheOrl` (`/profiles/<slug>.json?pid=practice-<id>&locale=fr` → téléphone du lieu, adresse, secteur en clair, actes → « audiom »), `secteurLabel`, `MESSAGE_TYPE` ; vue : lecture des fiches des 12 retenus (créneaux les plus proches d'abord, puis ordre de tri), règle « pas de téléphone = pas de ligne » + compteurs (sans numéro / non vérifiés), TOP 3, `tel:` + copier, Audiométrie ✅/⚠️, message type (global + par ligne) ; ménage `partenairesCache` au démarrage. Fiches testées sur 3 vrais praticiens depuis Node (numéro du lieu parfois `null` alors qu'un autre lieu du même médecin en a un → règle stricte appliquée : c'est le numéro du cabinet affiché qui compte).

## Reste à faire
- Étape 3 : filtres délai 7/14/30 j (`availabilitiesBefore` accepte 1/3/7/14 : 30 = sans filtre côté Doctolib + filtre local), secteur S1 seul / tous, rayon 20 → 40 → 60 automatique, cache 10 min par code postal, finitions.
- Étape 3 : adresse patient préremplie, iframe Google Maps, « Ouvrir dans Google Maps », « Ouvrir la fiche Salesforce », « Copier l'adresse ».

## Décisions
- Colonnes du rapport repérées par **libellé** (`detailColumnInfo[api].label`, regex tolérantes FR/EN), jamais par position : l'ordre du rapport peut changer.
- Lignes lues dans **toutes** les clés du `factMap` avec dédoublonnage par ID : marche pour un rapport tabulaire (`T!T`) comme pour un rapport groupé.
- Adresse : `value` objet `{street, postalCode, city}` si Salesforce le fournit, sinon découpage du texte (ligne `05000 Gap`, région/pays ignorés) ; repli sur « Code postal de facturation ».
- Étape 1 : tous les statuts affichés (badge si ≠ « Actif ») ; l'exclusion par défaut arrive avec la proximité (étape 2).
- Onglet Partenaires **uniquement sur une Piste** (décision du chef : règle les 6 onglets serrés).
- Cache **hors `AppData`** (décision du chef) : `chrome.storage.local` clé `partenairesCache`, comme `recentPatients` — chaque frappe dans le panneau réécrit tout `AppData`, 250 Ko de plus à chaque fois aurait gonflé `cockpit.json`.
- Une branche par étape, PR figées : étape 2 sur `feature/partner-search-proximite` créée depuis `main` après le merge de la PR #2.
- Table des codes postaux servie comme **fichier statique de l'extension** (`public/data/codes-postaux.json` → `fetch('data/codes-postaux.json')` au premier besoin, mémorisé en mémoire) plutôt qu'un `import()` dynamique : même effet (rien dans `panel.js`, chargement à la demande), pas de dépendance au bundler, et le script de génération peut être rejoué sans rebuild du code. Aucun appel réseau : le fichier est dans `dist/`.
- Code postal du patient inconnu de la table → centre du département (moyenne des codes postaux du même préfixe, 3 chiffres pour les DOM) avec message ; partenaire au code postal inconnu → non classé, compté dans une mention discrète.
- Distances arrondies au km (« < 1 km » sous 1 km), à vol d'oiseau (haversine), comme cadré.

## Questions ouvertes
(néant)
- Format du rapport Salesforce partenaires (CSV ? Excel ? colonnes : nom, adresse, code postal, ville, téléphone, coordonnées GPS ?) : à préciser au cadrage. « Le plus proche » = même département / préfixe de code postal, ou vraie distance (nécessite latitude/longitude ou une table code postal → coordonnées embarquée, sans appel réseau) ?
