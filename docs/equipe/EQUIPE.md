# Équipe Cockpit Audibene — charte commune

Ce document s'applique à tous les agents. Chaque agent tient en plus **son propre fichier** dans `docs/equipe/` (journal, décisions, questions). Le `CLAUDE.md` à la racine reste la référence technique (règles, architecture, pièges).

## Rôles

| Qui | Session | Rôle |
|---|---|---|
| **Benjamin** | — | Propriétaire. Décide des fonctionnalités, teste sur le vrai Salesforce, valide. |
| **Chef d'orchestre** | `projects-b4` (`72f84a`) | Seul à merger sur `main` et à publier les versions. Relit et teste chaque PR. Tient `CLAUDE.md`, `README.md`, la mémoire projet. |
| **Agent 1** | `Agent 1` (`77104a`) | Chantier **Partner Search** sur la branche `feature/partner-search`, dans son propre worktree. |

`main` est protégé sur GitHub : Pull Request obligatoire, aucun push direct — même pour le chef d'orchestre, qui merge les PR.

## Cycle de travail d'un agent

1. **Démarrer** : lire `CLAUDE.md`, `docs/equipe/EQUIPE.md`, son fichier `docs/equipe/<agent>.md`. Vérifier `git status`, `git fetch`, `git rebase origin/main`.
2. **Travailler** dans son worktree, sur sa branche `feature/<chantier>`. Petits commits, messages en français, trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. `npx tsc --noEmit` vert avant chaque commit, `npm run build` avant de livrer.
3. **Documenter au fil de l'eau** dans son fichier `docs/equipe/<agent>.md` : ce qui est fait, ce qui reste, les décisions prises et pourquoi, les questions ouvertes. Un lecteur qui arrive à froid doit comprendre l'état du chantier en deux minutes.
4. **Livrer** : `git push -u origin feature/<chantier>`, puis `gh pr create --base main` avec le gabarit ci-dessous, puis **message de session** au chef d'orchestre (`SendMessage` vers `projects-b4`) avec le numéro de la PR et le résumé.
5. **Relecture** : le chef d'orchestre relit, teste sur Salesforce (ou demande à Benjamin), demande des ajustements sur la PR si besoin, merge, publie une version.

## Gabarit de rapport (corps de la PR et message de session)

```
## Résumé
Ce que la PR apporte, en 3 lignes max, du point de vue de Benjamin (clics gagnés, ce qu'il voit).

## Fichiers touchés
- src/… — pourquoi

## Comment tester
1. Recharger l'extension (↻), F5 sur Salesforce.
2. Ouvrir une Piste avec un code postal → …
3. Résultat attendu : …

## Points d'attention
- Risques, limites connues, ce qui n'est pas fait.

## Questions
- Ce qui a besoin d'une décision de Benjamin ou du chef d'orchestre.
```

## Communication

- **Une question bloquante** → message de session immédiat au chef d'orchestre (ne pas deviner sur les points qui touchent Salesforce, les données ou l'interface de Benjamin).
- **Un doute non bloquant** → le noter dans « Questions » de son fichier et continuer avec l'hypothèse la plus simple, clairement indiquée.
- Toujours écrire pour un lecteur à froid : phrases complètes, chemins de fichiers, étapes de test reproductibles.
- Ne pas modifier `CLAUDE.md`, `README.md`, `EQUIPE.md`, les workflows GitHub ni le numéro de version : proposer les changements dans le rapport.

## Bonnes pratiques de code (rappel)

- Réutiliser `src/content/salesforce/dom.ts` (`deepAll`, `visibleEl`, `waitFor`, `setNativeValue`) et `src/panel/components/ui.tsx` (`Btn`, `Chip`, `Seg`, `Field`, `DeleteBtn`, `EditablePreview`) plutôt que de recréer.
- Nouvelle action Salesforce = un type dans `src/shared/messages.ts` + un cas dans `src/content/salesforce/index.ts` + une fonction dans `actions.ts`.
- Nouvel écran = un fichier dans `src/panel/views/`, branché dans `app.tsx` ; onglets adaptés au type de fiche (Piste / Opportunité).
- Données nouvelles = champ dans `AppData` (`model.ts`) + valeur par défaut dans `defaultData()` + prise en compte dans `normalize` et `mergeData` (`storage/legacy.ts`).
- Aucune boîte de dialogue navigateur ; pas d'appel réseau ; pas de dépendance ajoutée sans l'indiquer dans le rapport.
