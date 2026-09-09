# Chef d'orchestre — journal

Session : `projects-b4` (`72f84a`). Dossier : `Documents\Claude\Projects\Cockpit Audibene` (branche `main`).

## Responsabilités
- Relire et tester chaque PR ; merger sur `main` ; publier les versions (bump `public/manifest.json` + `npm pkg set version` + tag `vX.Y.Z`).
- Tenir `CLAUDE.md`, `README.md`, `docs/equipe/EQUIPE.md` et la mémoire projet à jour.
- Répondre aux questions des agents ; arbitrer ; remonter à Benjamin ce qui demande sa décision.

## État courant
- Version publiée : v1.0.18 (2026-09-09). Site : https://benjamin-mag.github.io/cockpit-audibene/
- `main` protégé (PR obligatoire) depuis le 2026-09-09.
- Chantiers ouverts : **Partner Search** (Agent 1, `feature/partner-search`).

## Relecture d'une PR — check-list
1. `gh pr checkout <n>` dans un worktree de relecture, `npm ci`, `npx tsc --noEmit`, `npm run build`.
2. Charger `dist/` dans Edge, tester le parcours décrit dans la PR sur une vraie fiche.
3. Vérifier : pas de `confirm()`, pas d'appel réseau, `visibleEl` sur toute lecture Salesforce, données ajoutées gérées par `normalize`/`mergeData`, textes en français, animations douces.
4. Merge (`gh pr merge --squash`), puis publication si la fonctionnalité est utilisable par Benjamin.

## Journal
- 2026-09-08 : projet créé, étapes 1–4 livrées, v1.0.0 → v1.0.9.
- 2026-09-09 : peaufinage (v1.0.10 → v1.0.18), guide `CLAUDE.md`, mise en place de l'équipe et de l'Agent 1.
