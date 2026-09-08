# Cockpit Audibene

Extension Chrome/Edge : un panneau latéral à côté de Salesforce qui regroupe, en un clic, ce que faisaient cinq extensions et deux sites séparés.

**Installation et notice pour l'équipe : https://benjamin-mag.github.io/cockpit-audibene/**

## Ce que fait le panneau

Deux pages, sélecteur en haut : **Cockpit** (la fiche ouverte et ses actions) et **Ventes** (suivi personnel).

**Cockpit** — la fiche Salesforce est lue automatiquement (nom, genre, téléphone, naissance, partenaire), et les onglets s'adaptent :

| Page ouverte | Actions |
|---|---|
| Piste | **Message vocal → non joignable** (1 clic ou `Ctrl+Shift+M`) · **COSI** (champs de l'anamnèse par puces → Appliquer) · **Anamnèse** (intro + résumé Salesforce + signature, écrite dans « Remarques générales profil client » puis Enregistrer) |
| Opportunité | **Mails** (modèles préremplis, insérés dans le composeur SF) · **Commentaire** (texte envoyé dans le Chat Partenaire) · **Vente CAT 1 / CAT 2** (vente du mois en 1 clic) |
| Doctolib / Acuitis | **Coller Prénom Nom** dans le formulaire de RDV (dernières fiches lues mémorisées) |

**Ventes** — mois, année, fiches de paie, primes et salaire estimé (concept de l'ancien suivi).

## Données

Copie de travail dans le navigateur + `cockpit.json` synchronisé dans un dossier choisi (le navigateur redemande l'accès à l'ouverture du panneau : bouton « Autoriser », les deux copies sont fusionnées, jamais écrasées). L'ancien `data.json` du générateur de mails est lu pour reprendre les modèles, jamais écrit. Import de l'export du suivi des ventes depuis Réglages ou la page Ventes.

## Développement

```bash
npm install
npm run build        # → dist/ (extension non empaquetée)
npm run dev          # aperçu du panneau dans un onglet (mode web)
npm run build:site   # → dist-site/ (page d'installation + version web)
npm run zip          # → release/cockpit-audibene.zip
```

Publier une version : monter `version` dans `public/manifest.json`, puis `git tag vX.Y.Z && git push origin vX.Y.Z` — GitHub construit le zip et le lien « dernière version » du site pointe dessus. Chaque push sur `main` redéploie le site.

Chaque build porte un identifiant (`__COCKPIT_BUILD__`) : le panneau remplace automatiquement un script de page d'une autre version.

## Structure

```
src/
  background.ts            service worker : ouverture du panneau, raccourcis
  content/                 script injecté (un seul fichier)
    salesforce/            shadow DOM Lightning, lecture de fiche, actions (MV, COSI, anamnèse, mail, chat)
    doctolib.ts acuitis.ts collage du patient
  panel.html + panel/      l'application (Preact) : views/, storage/, model.ts
  index.html               page d'installation (site)
  shared/                  types, messages, catalogue COSI, HTML mail
.github/workflows/         pages.yml (site), release.yml (zip sur tag)
```
