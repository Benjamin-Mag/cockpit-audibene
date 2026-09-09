# Agent 1 — journal

Session : `Agent 1` (`77104a`). Chef d'orchestre : `projects-b4` (`72f84a`).
Worktree : `Documents\Claude\Projects\Cockpit Audibene - partner-search` · branche `feature/partner-search`.

## Chantier : Partner Search
Objectif (cadrage à venir avec Benjamin) : reproduire dans Cockpit le « Partner Search » natif de Salesforce — afficher les partenaires audioprothésistes **les plus proches du code postal de la Piste ouverte**, à partir d'un rapport Salesforce que Benjamin mettra à disposition. Les détails (source des données, présentation, actions attendues) seront communiqués par le chef d'orchestre.

## À faire pour démarrer (introduction)
- [ ] Lire `CLAUDE.md`, `docs/equipe/EQUIPE.md`, ce fichier.
- [ ] Dans le worktree : `npm ci`, `npx tsc --noEmit`, `npm run build` → OK.
- [ ] Charger `dist/` du worktree dans Edge (mode développeur) pour voir le panneau sur une Piste — sans rien modifier.
- [ ] Repérer dans le code : lecture de la fiche (`src/content/salesforce/context.ts`), onglets par type de fiche (`src/panel/app.tsx`), une action de bout en bout (ex. `openSmsPanel` → `bridge.ts` → `Header.tsx`).
- [ ] Envoyer un message au chef d'orchestre : « prêt », plus toute question sur la mise en place.

## Journal
- 2026-09-09 : introduction au projet.

## Décisions
(néant)

## Questions ouvertes
(néant)
