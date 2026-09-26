# Cockpit Audibene — guide pour les agents

Extension Chrome/Edge (Manifest V3) : un panneau latéral à côté de Salesforce pour un conseiller audibene. Elle a remplacé cinq extensions et deux sites. Propriétaire : Benjamin Magnier (conseiller, non développeur — lui parler en français, sans jargon, et viser toujours **le moins de clics possible**).

> **Deux projets depuis le 2026-09-22.** Ce dépôt est la version d'équipe. Benjamin a sa copie privée **Cockpit Benjamin** (`Benjamin-Mag/cockpit-benjamin`, dossier `ProjectsCockpit Benjamin`, icône orange, versions 2.x) qui garde la page Ventes. Toute correction ou nouveauté publiée ici doit y être reportée par le chef d'orchestre (`git fetch upstream && git merge upstream/main` dans ce dossier). Rien ne remonte jamais de Cockpit Benjamin vers ce dépôt.

## Règles non négociables

1. **`main` est réservé au chef d'orchestre** (la session « projets-b4 »). Tout autre agent travaille sur une branche, ouvre une Pull Request et envoie un rapport ; le chef d'orchestre relit, teste, merge et publie. Ne jamais pousser sur `main`, ne jamais créer de tag.
2. **Ne jamais modifier les anciens repos** (`Générateur de mail`, `Suivi Ventes Primes`, `Colleur*`, `Extension Message Vocal`) : les collègues les utilisent encore. Lecture seule, comme référence.
3. **Pas de `confirm()` / `alert()` / `prompt()`** : bloqués dans un panneau latéral. Utiliser `DeleteBtn` (deux temps) et les toasts.
4. **Rien d'identifiable dans le dépôt** (il est public) : ni identifiant de fiche Salesforce (`00Q…`, `006…`), ni nom de patient, ni téléphone, ni e-mail, ni nom de partenaire réel, ni identifiant de rapport interne — y compris dans les journaux de `docs/`, les messages de commit et les Pull Requests. Pour un exemple, écrire « une Piste de test », « un centre partenaire ». Les vrais jeux d'essai restent en local.
5. **Aucune donnée ne quitte le poste** : pas de télémétrie, pas d'appel réseau — seules exceptions : l'ORL Finder interroge Doctolib avec les coordonnées GPS du code postal du patient (jamais son nom), et la page Partenaires demande à Doctolib ou à rdv.acuitis.com les créneaux libres d'un partenaire (rien du patient n'est envoyé). Les données vivent dans `chrome.storage.local` + `cockpit.json`.
6. Design : palette de l'ancien générateur (`--accent #1b4f9b`, fond `#eaf3fb`, Poppins), animations lentes et douces (≥ 280 ms), tout texte généré affiché dans un `EditablePreview`.
7. TypeScript strict, pas de commentaires explicatifs inutiles, commits en français avec le trailer `Co-Authored-By` du modèle Claude utilisé.

## Commandes

```bash
npm install
npm run build        # dist/ = extension non empaquetée (Edge/Chrome → mode développeur → charger dist/)
npm run dev          # aperçu du panneau dans un onglet (mode web, sans Salesforce) sur http://localhost:5173/panel.html
npm run build:site   # dist-site/ = page d'installation + version web
npm run zip          # release/cockpit-audibene.zip
npx tsc --noEmit     # vérification des types (à faire avant tout commit)
npm test             # banc d'essai Playwright : le vrai panneau dans un faux navigateur (Salesforce, Doctolib, Acuitis simulés) — voir tests/LISEZMOI.md
```

**Banc d'essai (depuis la v1.0.43)** : `tests/e2e/*.spec.ts`, faux navigateur `tests/e2e/faux-navigateur.js`, aides `tests/e2e/outils.ts`. Il teste le panneau, **pas** le script de page Salesforce. Données 100 % fictives (règle n°4). Plusieurs worktrees en même temps : donner à chacun son `PW_PORT`. Si le Chromium de Playwright n'est pas installé (`npx playwright install chromium`), utiliser le Chrome du poste : `CHROMIUM_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" npm test`. Tout correctif de comportement arrive avec un test qui échoue avant et passe après.

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
  partnerSearch.ts           onglet « Partner Search » de la Piste : partenaires, pastilles, « Commentaire Partnersearch » et liens (ouvre « Détails », referme)
src/content/doctolib.ts, acuitis.ts, forms.ts   collage du patient dans les formulaires de RDV
src/shared/                  messages.ts (protocole panneau ↔ page), types.ts, anamnese-catalog.ts (champs COSI), mail-html.ts
src/panel.html + src/panel/
  app.tsx                    état global, stockage, pont vers la page, onglets adaptés à la fiche (la page Ventes n'existe que dans Cockpit Benjamin depuis la v1.0.35)
  bridge.ts                  chrome.tabs/scripting/webNavigation : envoi aux cadres, injection, fiches récentes, presse-papier, délais maximum
  brouillons.ts              mémoire de session : saisies en cours par fiche (useBrouillon), dernière fiche lue (ficheMemo) et onglet Salesforce suivi (ongletSfGarde) ; ménage (onglets fermés 2 h, 30 fiches, 12 h)
  model.ts                   AppData (reglages, anamnese, chatPartenaire, templates, categories, ventes), variables, genre
  storage/data.ts            navigateur d'abord + dossier synchronisé (fusion), import/export
  storage/legacy.ts          formats anciens (data.json générateur, export ventes), fusion, partage, substitution de nom
  views/                     Header, Anamnese (=COSI), Commentaire (=Anamnèse), Mails, ChatPartenaire, Reglages, Setup
  views/OrlFinder.tsx        ORL Finder (Piste) : ORL Doctolib proches avec prochain créneau, TOP 3, message type
  views/Partenaires.tsx      page « Partenaires » (sélecteur du haut) : partenaires de Partner Search avec créneaux Doctolib
  partenaires-sf.ts          classement des liens (Doctolib public / agenda Pro / magasin Acuitis / autre site), choix des motifs, tri, cache 10 min par fiche
  acuitis.ts                 créneaux des magasins Acuitis (rdv.acuitis.com) : code magasin lu dans le lien, motifs = durées (30 min bilan auditif, 60 min 1er rendez-vous)
  orl-tri.ts                 tri (« Trier par ») et filtres rapides de l'ORL Finder : fonctions pures, aucun appel Doctolib
  orl-store.ts               réglages, tri et cache des résultats ORL (frais 10 min, réaffichables 2 h)
  doctolib.ts, geo.ts        appels Doctolib (recherche, créneaux, fiche praticien), via Doctolib Pro (session du conseiller) puis site public en secours, toujours exécutés dans un onglet du site (fetchViaTab) ; code postal → GPS (public/data/codes-postaux.json, script scripts/codes-postaux.mjs)
  components/ui.tsx          Btn, Chip, Seg, Field, DeleteBtn, EditablePreview, Toast, icônes
src/index.html               page d'installation (GitHub Pages)
.github/workflows/           pages.yml (site à chaque push main), release.yml (zip à chaque tag v*)
```

### Protocole panneau ↔ page
Le panneau envoie des `ContentRequest` (`src/shared/messages.ts`) via `chrome.tabs.sendMessage` ; la page répond par un `ContentResponse`. Avant tout envoi, `ensureContent` ping la page et injecte `content.js` si absent ou périmé. Le contexte (Piste/Opportunité, composeur ouvert) est poussé par un port tant que le panneau est ouvert. `lirePartnerSearch` → `{ ok, msg, partenaires: PartenaireSF[] }` (lecture de l'onglet Partner Search, au clic seulement). Pour un cadre précis (application Canvas), `sendToFrame` + `chrome.webNavigation.getAllFrames` + permission d'origine demandée au clic (`optional_host_permissions`).

### Vocabulaire de Benjamin (à respecter dans l'interface)
- **COSI** = remplir les champs de l'onglet Anamnèse d'une Piste par puces (`views/Anamnese.tsx`).
- **Anamnèse** = texte intro + résumé Salesforce collé + signature, écrit dans « Remarques générales profil client » (`views/Commentaire.tsx`).
- **Chat partenaire** = fil Chatter de l'Opportunité (`views/ChatPartenaire.tsx`).
- **Message vocal** = commentaire « MV » dans Commentaires internes + « Piste non joignable ».
- **Partenaires** = page à côté de Cockpit (sélecteur du haut, à la place des anciennes Ventes) : partenaires de la Piste lus dans Partner Search, créneaux Doctolib des partenaires qui ont une page publique (test auditif, première consultation avec puis sans ordonnance), créneaux Acuitis pour les magasins Acuitis (bilan auditif et 1er rendez-vous), agenda Doctolib Pro ou autre site en bouton. Le « Commentaire Partnersearch » est lu (c'est lui qui porte les liens de RDV) mais **plus affiché** depuis la v1.0.39 : Benjamin n'en avait pas besoin à l'écran.
- **Hearo** = utilitaire SMS de la barre du bas (app Canvas, libellé variable : Hearo / Nouveau message / Approbation en attente).
- **ORL Finder** = onglet de la Piste : ORL proches du patient (Doctolib) avec créneau visible, tri créneau disponible → secteur 1 avant secteur 2 → créneau le plus tôt → distance (v1.0.33), « pas de téléphone = pas de ligne », TOP 3, message type audiométrie, itinéraire Google Maps. « Trier par » (pertinence / plus tôt / plus proche, mémorisé), puces cumulables et recherche par nom ou ville : tout se fait sur les résultats déjà chargés (v1.0.34).

## Pièges Salesforce connus (ne pas réintroduire)
- Salesforce Console garde plusieurs fiches montées en même temps : toujours passer par `visibleEl` (taille rendue > 0) et **ne jamais retourner un candidat invisible** par défaut.
- **Une seule lecture de page par action** : le coût d'un `deepAll` vient de la traversée du shadow DOM (un appel navigateur par élément). Regrouper les recherches avec `deepGroup([...])` puis `valeurChamp(labels, ...)` (v1.0.33 : lecture de fiche 3 à 4 fois plus rapide).
- Shadow DOM : `.shadowRoot` d'abord, puis `chrome.dom.openOrClosedShadowRoot` (l'ordre inverse a déjà cassé la lecture).
- Chercher les éléments par **texte / titre / placeholder**, jamais par position ni référence gardée : Lightning re-rend après chaque clic.
- Un `<label>` créé par nous dans la page entrerait en collision avec la recherche de labels Salesforce : le panneau vit dans le side panel, pas dans la page.
- « Traitement médical » (liste double) refuse les clics scriptés (`event.isTrusted`) : reste manuel.
- Après « Enregistrer », attendre ~1,2 s avant le clic suivant (re-rendu).
- **Choisir le dossier doit toujours laisser une copie dans le navigateur** (`chooseFolder` → `localWrite`) : Edge retire l'accès au dossier dès que le panneau se ferme. Sans cette copie, une extension réinstallée rouvrait sur l'écran « prénom nom » avec un bouton « C'est parti » mort (v1.0.44, test `65-reinstallation`). Sans copie ni accès, l'accueil repropose le dossier (`needs-folder`).
- **Le navigateur recharge le panneau à chaque changement d'onglet** : aucune information ne survit dans une variable ou un `useRef`. Même principe pour les écrans qui interrogent le réseau (ORL Finder, Partenaires) : **réafficher d'abord ce qui est en cache, relancer ensuite seulement si c'est périmé, et sans vider la liste** (`CACHE_MS` = encore frais, `CACHE_VUE_MS` = encore affichable ; v1.0.42). Ce qui doit survivre va en mémoire de session (`brouillons.ts`) : les saisies, la dernière fiche lue (`ficheMemo`, réaffichée aussitôt, relue seulement si elle a plus de `FICHE_FRAICHE_MS`) et l'onglet Salesforce suivi (`ongletSfGarde`, sans lequel le panneau perdait la fiche en passant sur un site quelconque — v1.0.40).
- **Le panneau garde la dernière fiche Salesforce** quand l'utilisateur passe sur un site sans rapport (`ongletSf` dans `app.tsx`) : les actions visent cet onglet en arrière-plan. Toute nouvelle saisie dans un onglet du panneau doit utiliser `useBrouillon(ficheKey, 'ecran.champ', départ)` au lieu de `useState`, et un aperçu retouché passe `retouche` à `EditablePreview`.
- **Jamais de lecture `deepAll` périodique** (minuterie) dans la page Salesforce : parcourir tout le shadow DOM Lightning toutes les quelques secondes a figé Salesforce (v1.0.27, puis v1.0.32 : le suivi de contexte toutes les 0,8 s cherchait le composeur d'e-mail dans toute la page, coût proportionnel aux fiches gardées par la console, d'où des gels « de plus en plus » fréquents). Le port de contexte ne lit que l'adresse (`currentContext`). Les lectures lourdes se font au clic ou au changement de fiche.
- Le champ « Commentaires » des Commentaires internes n'est PAS l'anamnèse : l'anamnèse va dans « Remarques générales profil client » (rubrique Commentaire en bas de la Piste).
- Chatter : la zone « Partager une mise à jour… » devient un éditeur riche au focus ; taper via `execCommand('insertText')`, puis bouton « Envoyer un message ».
- **Les champs d'une fiche ne sont dans la page que si son sous-onglet est affiché** : sur « Partner Search », plus rien n'est lisible. `readFiche` passe alors sur le sous-onglet des champs (« Anamnèse » / « Détails », jamais un onglet portant un autre nom), lit **tout** — y compris le code postal — puis rend l'utilisateur à son sous-onglet (v1.0.40). Trois règles depuis la v1.0.45 : le sous-onglet à rendre est mémorisé **par son texte** et retrouvé au moment de revenir (`revenirSur`), jamais par élément gardé — Lightning reconstruit la barre après un clic et l'ancien élément devient muet ; les lectures qui changent de sous-onglet (`readFiche`, `lirePartnerSearch`) passent par `enSerie` pour ne jamais se croiser ; et la lecture de Partner Search reste **invisible** (règle ferme de Benjamin, v1.0.47) : le sous-onglet précédent est remis dès la lecture finie, et `revenirSur` attend que Lightning l'ait vraiment affiché avant de rendre la main, pour que la lecture suivante parte d'une barre stable.
- Composeur d'e-mail de l'Opportunité : boutons **Client / Partenaire** en haut (destinataire). Les mêmes libellés existent dans le formulaire de résumé d'appel : ne chercher le choix que dans le composeur, délimité par l'éditeur `.ql-editor` et son bouton « Envoyer » (`composerOf` dans `actions.ts`). Choisir le destinataire AVANT de remplir objet et corps. Juste après l'ouverture, les boutons arrivent après l'éditeur et Salesforce vide le corps en finissant son affichage : attendre, insérer, puis vérifier que le corps est toujours là.

## Pièges Doctolib connus (ne pas réintroduire)
- `/search/availabilities.json` : les listes se passent en **`agenda_ids[]=1&agenda_ids[]=2`** (idem `practice_ids[]`). Avec des virgules, Doctolib répond **400 « agenda_ids: must be an array »** dès qu'un centre a plusieurs agendas — un centre à agenda unique passait, d'où un bug invisible en test (v1.0.38). Tout passe par `paramsCreneaux()` dans `doctolib.ts`.
- `start_date_time` doit être une heure **locale avec décalage** (`2026-09-26T16:00:00+02:00`), pas un `Z`.

### Autorisation du dossier
Le navigateur oublie l'autorisation d'écrire dans le dossier dès que le panneau se ferme, et rien ne permet de la redonner sans un clic de l'utilisateur. Le bandeau ne sort donc **que s'il y a quelque chose à copier** : `cockpit-dossier-ecrit` (localStorage) garde la date des données au moment de la dernière écriture réussie, et le bandeau apparaît quand `data.updatedAt` la dépasse — ouvrir et fermer le panneau sans rien changer ne demande plus rien (v1.0.41). Il reste masquable définitivement par **Ne plus demander** (`cockpit-dossier-silence`), et l'autorisation se redonne quand on veut depuis Réglages. Les données, elles, sont **toujours** écrites dans le navigateur, autorisation ou pas.

## Données
`AppData` (voir `model.ts`) : `reglages`, `anamnese {situations, textes ({{resume}} = emplacement du résumé), phrases}`, `chatPartenaire`, `templates`, `categories`, `ventes` (plus affiché ici, mais **gardé** dans les données et les fusions : le même `cockpit.json` peut servir à Cockpit Benjamin). Variables de texte : `{{nom}}`, `{{date}}`, `{{heure}}`, `{{nom partenaire}}`, `{{adresse}}`, `{{nom_conseiller}}`, `{{tel_conseiller}}`, `{{email_conseiller}}`, `{{titre_conseiller}}` ; formes `patient(e)`, `il(elle)`, `conseiller(ère)` résolues par `resolveGenre`.
Toute fusion de données passe par `mergeData` / `mergeVentes` / `mergePartage` (union, jamais de perte).

## Publier une version (chef d'orchestre uniquement)
1. `npx tsc --noEmit` puis `npm run build`.
2. Monter `version` dans `public/manifest.json` et `npm pkg set version=X.Y.Z`.
3. `main` est protégé : commit sur une branche `chore/vX.Y.Z`, `gh pr create`, `gh pr merge --squash --delete-branch`, puis `git checkout main && git pull`, `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. Vérifier `gh run list --repo Benjamin-Mag/cockpit-audibene` : Release (zip) en succès.
5. **Copier la version chez Benjamin** : `cp -r dist/. "../Extensions installees/Cockpit Audibene/"` (et, depuis le dépôt Cockpit Benjamin, vers `../Extensions installees/Cockpit Benjamin/`). Toutes ses extensions non empaquetées vivent dans `Documents\Claude\Projects\Extensions installees\` — plus rien dans Téléchargements depuis le 2026-09-26. Il n'a plus qu'à faire ↻ dans `edge://extensions`. Edge lie une extension à son chemin : ne jamais déplacer ces dossiers.
6. **Mettre le zip à disposition des collègues** : ce dépôt est **privé** depuis le 2026-09-26, donc `npm run zip` puis
   `gh release create vX.Y.Z --repo Benjamin-Mag/cockpit-audibene-install release/cockpit-audibene.zip release/cockpit-audibene-X.Y.Z.zip`.
   Le dépôt public `cockpit-audibene-install` (dossier `Projects/Page installation Cockpit`) ne contient **que** la page d'installation et les zips : jamais de code, jamais de journal.
   Lien unique pour les collègues : https://benjamin-mag.github.io/cockpit-audibene-install/
7. Reporter dans Cockpit Benjamin (`git fetch upstream && git merge upstream/main`, version 2.x) et remettre la branche `design/essai` au niveau si elle sert.
## Travailler en équipe
- Un agent = une branche `feature/<chantier>` dans son propre worktree (`git worktree add`), jamais dans le dossier principal.
- Avant de commencer : `git fetch && git rebase origin/main` ; petits commits ; `npx tsc --noEmit` vert.
- Fin de tâche : `git push -u origin feature/<chantier>`, `gh pr create` (titre + ce qui change + comment tester), puis message au chef d'orchestre avec : résumé, fichiers touchés, comment tester sur Salesforce, points d'attention, questions.
- Ne pas modifier `CLAUDE.md`, `README.md`, les workflows ni la version : proposer les changements dans le rapport.
