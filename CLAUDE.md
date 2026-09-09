# Cockpit Audibene — guide pour les agents

Extension Chrome/Edge (Manifest V3) : un panneau latéral à côté de Salesforce pour un conseiller audibene. Elle a remplacé cinq extensions et deux sites. Propriétaire : Benjamin Magnier (conseiller, non développeur — lui parler en français, sans jargon, et viser toujours **le moins de clics possible**).

## Règles non négociables

1. **`main` est réservé au chef d'orchestre** (la session « projets-b4 »). Tout autre agent travaille sur une branche, ouvre une Pull Request et envoie un rapport ; le chef d'orchestre relit, teste, merge et publie. Ne jamais pousser sur `main`, ne jamais créer de tag.
2. **Ne jamais modifier les anciens repos** (`Générateur de mail`, `Suivi Ventes Primes`, `Colleur*`, `Extension Message Vocal`) : les collègues les utilisent encore. Lecture seule, comme référence.
3. **Pas de `confirm()` / `alert()` / `prompt()`** : bloqués dans un panneau latéral. Utiliser `DeleteBtn` (deux temps) et les toasts.
4. **Aucune donnée ne quitte le poste** : pas d'appel réseau, pas de télémétrie. Les données vivent dans `chrome.storage.local` + `cockpit.json`.
5. Design : palette de l'ancien générateur (`--accent #1b4f9b`, fond `#eaf3fb`, Poppins), animations lentes et douces (≥ 280 ms), tout texte généré affiché dans un `EditablePreview`.
6. TypeScript strict, pas de commentaires explicatifs inutiles, commits en français avec le trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Commandes

```bash
npm install
npm run build        # dist/ = extension non empaquetée (Edge/Chrome → mode développeur → charger dist/)
npm run dev          # aperçu du panneau dans un onglet (mode web, sans Salesforce) sur http://localhost:5173/panel.html
npm run build:site   # dist-site/ = page d'installation + version web
npm run zip          # release/cockpit-audibene.zip
npx tsc --noEmit     # vérification des types (à faire avant tout commit)
```

Tester dans un vrai Salesforce : `edge://extensions` → ↻ sur la carte de l'extension, puis F5 sur l'onglet Salesforce si le script de page a changé (le panneau ré-injecte normalement tout seul un script périmé grâce à l'identifiant de build).

## Architecture

```
public/manifest.json         permissions, side_panel, content_scripts (SF, Doctolib, Acuitis), commandes clavier
scripts/build.mjs            build panneau + service worker + script de contenu avec un même __COCKPIT_BUILD__
src/background.ts            service worker : ouverture du panneau, raccourcis (open-panel, run-mv)
src/content/main.ts          point d'entrée unique du script de contenu, routé par domaine ; marqueur window.__cockpit (version, dispose)
src/content/salesforce/
  dom.ts                     traversée du shadow DOM Lightning (deepAll/deepFirst), visibleEl, waitFor, setNativeValue, labels, Enregistrer
  context.ts                 type de page (Piste/Opportunité), lecture de la fiche (nom, genre, tél, naissance, code postal + ville, partenaire, adresse)
  actions.ts                 MV, commentaire (Remarques générales profil client), Chat Partenaire (Chatter), SMS Hearo, COSI, mail
  index.ts                   écouteur de messages du cadre principal + port de contexte
  frame.ts                   cadres secondaires (dont l'app Canvas Hearo) : ping + recherche SMS
src/content/doctolib.ts, acuitis.ts, forms.ts   collage du patient dans les formulaires de RDV
src/shared/                  messages.ts (protocole panneau ↔ page), types.ts, anamnese-catalog.ts (champs COSI), mail-html.ts
src/panel.html + src/panel/
  app.tsx                    état global, stockage, pont vers la page, pages Cockpit/Ventes, onglets adaptés à la fiche
  bridge.ts                  chrome.tabs/scripting/webNavigation : envoi aux cadres, injection, fiches récentes, presse-papier
  model.ts                   AppData (reglages, anamnese, chatPartenaire, templates, categories, ventes), variables, genre
  storage/data.ts            navigateur d'abord + dossier synchronisé (fusion), import/export
  storage/legacy.ts          formats anciens (data.json générateur, export ventes), fusion, partage, substitution de nom
  views/                     Header, Anamnese (=COSI), Commentaire (=Anamnèse), Mails, ChatPartenaire, Ventes, Reglages, Setup
  components/ui.tsx          Btn, Chip, Seg, Field, DeleteBtn, EditablePreview, Toast, icônes
src/index.html               page d'installation (GitHub Pages)
.github/workflows/           pages.yml (site à chaque push main), release.yml (zip à chaque tag v*)
```

### Protocole panneau ↔ page
Le panneau envoie des `ContentRequest` (`src/shared/messages.ts`) via `chrome.tabs.sendMessage` ; la page répond par un `ContentResponse`. Avant tout envoi, `ensureContent` ping la page et injecte `content.js` si absent ou périmé. Le contexte (Piste/Opportunité, composeur ouvert) est poussé par un port tant que le panneau est ouvert. Pour un cadre précis (application Canvas), `sendToFrame` + `chrome.webNavigation.getAllFrames` + permission d'origine demandée au clic (`optional_host_permissions`).

### Vocabulaire de Benjamin (à respecter dans l'interface)
- **COSI** = remplir les champs de l'onglet Anamnèse d'une Piste par puces (`views/Anamnese.tsx`).
- **Anamnèse** = texte intro + résumé Salesforce collé + signature, écrit dans « Remarques générales profil client » (`views/Commentaire.tsx`).
- **Chat partenaire** = fil Chatter de l'Opportunité (`views/ChatPartenaire.tsx`).
- **Message vocal** = commentaire « MV » dans Commentaires internes + « Piste non joignable ».
- **Hearo** = utilitaire SMS de la barre du bas (app Canvas, libellé variable : Hearo / Nouveau message / Approbation en attente).

## Pièges Salesforce connus (ne pas réintroduire)
- Salesforce Console garde plusieurs fiches montées en même temps : toujours passer par `visibleEl` (taille rendue > 0) et **ne jamais retourner un candidat invisible** par défaut.
- Shadow DOM : `.shadowRoot` d'abord, puis `chrome.dom.openOrClosedShadowRoot` (l'ordre inverse a déjà cassé la lecture).
- Chercher les éléments par **texte / titre / placeholder**, jamais par position ni référence gardée : Lightning re-rend après chaque clic.
- Un `<label>` créé par nous dans la page entrerait en collision avec la recherche de labels Salesforce : le panneau vit dans le side panel, pas dans la page.
- « Traitement médical » (liste double) refuse les clics scriptés (`event.isTrusted`) : reste manuel.
- Après « Enregistrer », attendre ~1,2 s avant le clic suivant (re-rendu).
- Le champ « Commentaires » des Commentaires internes n'est PAS l'anamnèse : l'anamnèse va dans « Remarques générales profil client » (rubrique Commentaire en bas de la Piste).
- Chatter : la zone « Partager une mise à jour… » devient un éditeur riche au focus ; taper via `execCommand('insertText')`, puis bouton « Envoyer un message ».

## Données
`AppData` (voir `model.ts`) : `reglages`, `anamnese {situations, textes ({{resume}} = emplacement du résumé), phrases}`, `chatPartenaire`, `templates`, `categories`, `ventes`. Variables de texte : `{{nom}}`, `{{date}}`, `{{heure}}`, `{{nom partenaire}}`, `{{adresse}}`, `{{nom_conseiller}}`, `{{tel_conseiller}}`, `{{email_conseiller}}`, `{{titre_conseiller}}` ; formes `patient(e)`, `il(elle)`, `conseiller(ère)` résolues par `resolveGenre`.
Toute fusion de données passe par `mergeData` / `mergeVentes` / `mergePartage` (union, jamais de perte).

## Publier une version (chef d'orchestre uniquement)
1. `npx tsc --noEmit` puis `npm run build`.
2. Monter `version` dans `public/manifest.json` et `npm pkg set version=X.Y.Z`.
3. Commit, `git push origin main`, `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. Vérifier `gh run list` : Release (zip) et Site (Pages) en succès.

## Travailler en équipe
- Un agent = une branche `feature/<chantier>` dans son propre worktree (`git worktree add`), jamais dans le dossier principal.
- Avant de commencer : `git fetch && git rebase origin/main` ; petits commits ; `npx tsc --noEmit` vert.
- Fin de tâche : `git push -u origin feature/<chantier>`, `gh pr create` (titre + ce qui change + comment tester), puis message au chef d'orchestre avec : résumé, fichiers touchés, comment tester sur Salesforce, points d'attention, questions.
- Ne pas modifier `CLAUDE.md`, `README.md`, les workflows ni la version : proposer les changements dans le rapport.
