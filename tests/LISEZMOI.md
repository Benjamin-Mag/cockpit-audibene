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
- `60-glisser` : réordonner par glisser-déposer les catégories de Mails (éditeur et puces) et les textes du Chat partenaire.
- `60-page-muette` : Salesforce figé (le script de page ne répond plus) → « Lecture impossible » et message d'erreur au lieu d'un chargement sans fin (horloge avancée, pas d'attente réelle).
- `60-mails` : partenaire et adresse lus à la demande, champs saisis à la main, catégorie remise à « Tous » au changement Patient / Partenaire, modèles SMS sans objet.
- `60-cosi-anamnese` : intensité COSI envoyée seulement si touchée, « Aucune valeur choisie », échec d'écriture qui garde le brouillon ; Anamnèse retouchée puis écrite, retouche remise à zéro au changement de genre.
- `60-orl` : filtres rapides et compteurs, « Afficher 10 ORL de plus », ORL sans téléphone écarté, repli sur le site public sans session Doctolib Pro.
- `60-fiches-raccourci` : raccourci clavier MV relayé par le service worker, brouillons rangés par fiche (Piste → Opportunité → Piste).
- `60-dossier` : dossier synchronisé en pause (dossier simulé dans le stockage privé du navigateur) : bandeau, Autoriser, refus, Ne plus demander.

Scénarios du faux navigateur (`ouvrir(page, { … })`, voir `Scenario` dans `e2e/outils.ts`) : `echecs`, `ficheSansGenre`, `doctolibBloque`, `sansDoctolibPro`, `partnerSearchVide`, `creneauxEnDouble`, `pageMuette`, `partenaireALaDemande`, `beaucoupOrl`, `dossier`.
Un test marqué `test.fixme` décrit un défaut connu du panneau (commentaire au-dessus du test) : il est sauté tant que le défaut n’est pas corrigé. (Aucun aujourd’hui.)

Les tests cherchent les boutons par leur **nom** (texte ou titre), pas par leur place : ils servent aussi à vérifier qu'un nouveau design n'a perdu aucune fonction.
Ce banc ne remplace pas l'essai sur le vrai Salesforce (le script de page n'est pas testé ici, seulement le panneau).
