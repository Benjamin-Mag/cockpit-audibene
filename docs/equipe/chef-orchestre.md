# Chef d'orchestre — journal

Session : `projects-b4` (`72f84a`). Dossier : `Documents\Claude\Projects\Cockpit Audibene` (branche `main`).

## Responsabilités
- Relire et tester chaque PR ; merger sur `main` ; publier les versions (bump `public/manifest.json` + `npm pkg set version` + tag `vX.Y.Z`).
- Tenir `CLAUDE.md`, `README.md`, `docs/equipe/EQUIPE.md` et la mémoire projet à jour.
- Répondre aux questions des agents ; arbitrer ; remonter à Benjamin ce qui demande sa décision.

## État courant
- Version publiée : v1.0.24 (2026-09-11). Site : https://benjamin-mag.github.io/cockpit-audibene/
- `main` protégé (PR obligatoire) depuis le 2026-09-09.
- Chantiers ouverts : aucun. ORL Finder complet (étapes 1–3) ; retours de Benjamin attendus sur la v1.0.23 (appels Doctolib portés par l'onglet du site).

## Relecture d'une PR — check-list
1. `gh pr checkout <n>` dans un worktree de relecture, `npm ci`, `npx tsc --noEmit`, `npm run build`.
2. Charger `dist/` dans Edge, tester le parcours décrit dans la PR sur une vraie fiche.
3. Vérifier : pas de `confirm()`, pas d'appel réseau, `visibleEl` sur toute lecture Salesforce, données ajoutées gérées par `normalize`/`mergeData`, textes en français, animations douces.
4. Merge (`gh pr merge --squash`), puis publication si la fonctionnalité est utilisable par Benjamin.

## Journal
- 2026-09-08 : projet créé, étapes 1–4 livrées, v1.0.0 → v1.0.9.
- 2026-09-09 : peaufinage (v1.0.10 → v1.0.18), guide `CLAUDE.md`, mise en place de l'équipe et de l'Agent 1.
- 2026-09-09 : PR #2 (Agent 1, Partner Search étape 1) → v1.0.20. Benjamin change d'avis : Partner Search abandonné, remplacé par **ORL Finder** (prompt de Renaud Laurencin ; décisions : Doctolib d'abord, recherche en arrière-plan + lien « Ouvrir sur Doctolib », créneau visible seulement, rayon 20 km élargi si rien, pas de transfrontalier). Reconnaissance des API Doctolib faite par moi (voir mémoire projet).
- 2026-09-09 : PR #4 (ORL Finder étape 1) → v1.0.21 (permission cookies retirée, table codes postaux embarquée). PR #6 (étape 2 : téléphone, secteur, audiométrie, message type, TOP 3) → v1.0.22. Arbitrages : médecin sans numéro au lieu trouvé mais numéro ailleurs → affiché avec mention « autre cabinet » ; fiches praticien chargées : 20 max dans l'ordre du tri.
- 2026-09-09 : Benjamin teste la v1.0.22 : Doctolib bloque les appels partis du panneau (anti-robot, origine chrome-extension). Correctif préparé sur `fix/doctolib-via-onglet` (fetch exécuté dans l'onglet Doctolib en monde principal, `fetchViaTab`), intégré par l'Agent 1 dans sa PR #9 (étape 3 : filtres délai/secteur, rayon 20→40→60, cache 10 min, « autre cabinet », 20 fiches par paquets de 5, bouton « Voir l'onglet Doctolib »). Mergée → **v1.0.23**. Arbitrage : délai par défaut « tous » (14 j masquait les ORL sans RDV en ligne mais joignables), filtre délai côté API quand il est choisi.
- 2026-09-11 : demande de Benjamin : réordonner les textes du Chat partenaire → glisser-déposer des puces et des lignes de gestion, via un hook partagé `useDragReorder` + `moveById` (`components/drag.ts`) qui remplace aussi le code local de Mails. Au passage, bug d'accueil corrigé : « Sans dossier » restait bloqué à l'étape 1 sans modèle (`needsFolder`). Relecture adversariale par workflow (3 lentilles, 2 sceptiques par constat : 4 confirmés mineurs, corrigés ; 5 réfutés). Vérifié dans l'aperçu web (DnD simulé, ordre enregistré). → **v1.0.24**.
