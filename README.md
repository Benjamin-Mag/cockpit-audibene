# Cockpit Audibene

Extension Chrome/Edge : un panneau latéral à côté de Salesforce qui regroupe, en un clic, ce que faisaient cinq extensions et deux sites séparés :

- **MV non joignable** — commentaire + Enregistrer + « Piste non joignable » (bouton ou `Ctrl+Shift+M`)
- **Anamnèse** — remplit les champs de l'onglet Anamnèse d'une Piste par puces, puis « Appliquer »
- **Commentaire** — intro + résumé Salesforce (presse-papier) + signature, écrit directement dans la fiche
- **Mails** *(étape 2)* — modèles patient/partenaire préremplis depuis la fiche, insérés dans le composeur SF
- **RDV** *(étape 2)* — colle le patient courant dans Doctolib / Acuitis
- **Ventes** *(étape 3)* — suivi des ventes, primes et salaire estimé

Les infos de la fiche ouverte (nom, genre, téléphone, naissance, partenaire) sont lues automatiquement — plus rien à copier.

## Données

Un seul fichier `data.json` dans un dossier choisi au premier lancement (comme l'ancien générateur de mails : choisir le même dossier reprend les modèles existants). Import possible de l'ancien export du suivi des ventes depuis Réglages. Rien ne quitte le poste.

## Développement

```bash
npm install
npm run build      # → dist/ (à charger comme extension non empaquetée)
npm run dev        # aperçu du panneau dans un onglet (mode web, sans Salesforce)
npm run zip        # → release/cockpit-audibene-<version>.zip
```

Installation : `chrome://extensions` (ou `edge://extensions`) → Mode développeur → « Charger l'extension non empaquetée » → dossier `dist/`.

## Structure

```
src/
  background.ts            service worker : ouverture du panneau, raccourcis
  content/                 script injecté dans les pages (un seul fichier, sans import)
    salesforce/dom.ts      traversée du shadow DOM Lightning, champs, boutons
    salesforce/context.ts  détection Piste/Opportunité, lecture de la fiche
    salesforce/actions.ts  MV, commentaire, anamnèse, mail
  panel.html + panel/      l'application du panneau (Preact)
    storage/               dossier + data.json, import des anciens formats
    views/                 Header, Anamnèse, Commentaire, Réglages, Setup
  shared/                  types, messages, catalogue anamnèse, HTML mail
```
