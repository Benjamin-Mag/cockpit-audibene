# Banc d'essai du panneau

Le **vrai panneau** (celui de `npm run dev`) tourne dans un **faux navigateur** (`e2e/faux-navigateur.js`) qui joue
l'onglet Salesforce (Piste, Opportunité, accueil), Doctolib, Acuitis et un site quelconque. Chaque demande du panneau
à la page (MV, COSI, anamnèse, mail, chat, collage…) et chaque appel Doctolib / Acuitis est noté, puis vérifié.

```bash
npx playwright install chromium   # une seule fois par poste
npm test                          # toute la batterie (~1 min)
npx playwright show-report tests/rapport
```

- `00-demarrage` : premier lancement, fiche affichée.
- `10-piste` : Message vocal, relire, COSI (puces, texte libre, brouillon gardé hors Salesforce et après rechargement), Anamnèse (résumé, écrire, copier, situations, verrou genre).
- `20-orl-partenaires` : ORL Finder (TOP 3, tri, recherche, message type, itinéraire, Doctolib bloqué, aucun nom de patient envoyé, `agenda_ids[]`), Partenaires (Doctolib, Acuitis, agenda Pro, sans lien, créneaux en double).
- `30-opportunite` : Mails (Client / Partenaire, date, heure, SMS, retouche, verrou genre, modèles et catégories), Chat partenaire, SMS Hearo.
- `40-autres` : collage Doctolib / Acuitis, sans fiche, Réglages (signature, MV, export, partage, import d'un collègue sans perte), et un passage qui **clique chaque bouton de chaque écran** sans erreur.

Les tests cherchent les boutons par leur **nom** (texte ou titre), pas par leur place : ils servent aussi à vérifier qu'un nouveau design n'a perdu aucune fonction.
Ce banc ne remplace pas l'essai sur le vrai Salesforce (le script de page n'est pas testé ici, seulement le panneau).
