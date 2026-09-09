# Chef d'orchestre — journal

Session : `projects-b4` (`72f84a`). Dossier : `Documents\Claude\Projects\Cockpit Audibene` (branche `main`).

## Responsabilités
- Relire et tester chaque PR ; merger sur `main` ; publier les versions (bump `public/manifest.json` + `npm pkg set version` + tag `vX.Y.Z`).
- Tenir `CLAUDE.md`, `README.md`, `docs/equipe/EQUIPE.md` et la mémoire projet à jour.
- Répondre aux questions des agents ; arbitrer ; remonter à Benjamin ce qui demande sa décision.

## État courant
- Version publiée : v1.0.22 (2026-09-09). Site : https://benjamin-mag.github.io/cockpit-audibene/
- `main` protégé (PR obligatoire) depuis le 2026-09-09.
- Chantiers ouverts : **ORL Finder** étape 3 (Agent 1, `feature/orl-finder-3`) : filtres délai/secteur, rayon 20 → 40 → 60 km, cache 10 min, finitions.
- À confirmer par Benjamin : les appels Doctolib passent-ils depuis le panneau sur son poste (anti-robot) ? Plan B : appels depuis un onglet Doctolib en arrière-plan.

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
