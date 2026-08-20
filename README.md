# RH Capacité — Cockpit V3

Nouvelle saisie de masse calendrier intégrée au module Cockpit.

Fonctions : filtre équipe, ressources actives, mois glissant, motif sélectionné en amont, saisie multi-cellules, statut et commentaire communs, sauvegarde en masse dans `Presences`.

Le module Administration reste séparé et continue à gérer Team, Team_ref, Motifs_RH et Parametres_Alertes.


## V3.1
- Suppression de la légende redondante sous la grille de saisie de masse.
- L'espace vertical est désormais entièrement consacré au calendrier et aux ressources.


## V3.2
- Les trois blocs de la saisie de masse sont désormais empilés verticalement.
- Chaque bloc occupe toute la largeur disponible.
- Les contrôles à l'intérieur des blocs sont disposés horizontalement pour réduire leur hauteur.
- La grille calendrier commence plus haut et bénéficie de davantage de largeur.


## V3.3 — Import CSV
Format : Nom_Ressource;Email;Equipe_Code;Role;Capacite_ETP;Date;Motif;Statut;Commentaire. Ressource identifiée par email puis nom. Ressource inexistante créée dans Team. Motifs inconnus bloquants. Présence Ressource+Date existante mise à jour, sinon créée.


## V3.4 — Création automatique des équipes
Lors de l'import CSV, si `Equipe_Code` n'existe ni dans `Team_ref.Code` ni dans `Team_ref.Libelle`, le widget crée automatiquement une ligne dans `Team_ref`.
La nouvelle équipe reçoit :
- `Code` = valeur de `Equipe_Code`
- `Libelle` = valeur de `Equipe_Code`
- `Description` = `Créée automatiquement par import CSV`

Les nouvelles ressources sont ensuite reliées à l'équipe créée.
Ordre de traitement : équipes -> ressources -> présences.


## V3.5 — Import Excel + choix explicite de la feuille
- Le fichier Excel est chargé dans le navigateur.
- Le widget liste les feuilles du classeur.
- L'utilisateur doit choisir explicitement la feuille à importer.
- Le calendrier horizontal est détecté automatiquement dans cette feuille.
- Une cellule vide en jour ouvré peut être interprétée comme `P` (option cochée par défaut).
- L'équipe par défaut est saisissable avant analyse.
- Les données Excel sont normalisées vers le même format interne que le CSV.
- Le même moteur de contrôle/import crée ensuite équipes, ressources et présences.


## V3.6 — Correctif des en-têtes CSV
- suppression du BOM UTF-8 ;
- prise en charge CRLF/CR/LF ;
- suppression des espaces insécables ;
- comparaison des en-têtes insensible à la casse, accents, espaces, `_` et `-` ;
- `Commentaire`, ` commentaire ` ou variantes équivalentes sont normalisés ;
- en cas d'erreur, le diagnostic affiche les colonnes réellement détectées.


## V3.7 — Réinitialisation des imports
Deux boutons `Réinitialiser` ont été ajoutés :

### Import CSV
Le bouton remet à zéro :
- le fichier CSV sélectionné ;
- l'analyse ;
- la prévisualisation ;
- les compteurs ;
- le bouton Importer.

### Import Excel
Le bouton remet à zéro :
- le fichier Excel sélectionné ;
- le classeur chargé en mémoire ;
- la feuille choisie ;
- l'analyse ;
- la prévisualisation ;
- les compteurs ;
- l'équipe par défaut (`EQUIPE_EXCEL`) ;
- l'option `cellule vide en jour ouvré = P`.

Aucune donnée déjà enregistrée dans Grist n'est supprimée.


## V3.8 — Correctif du bouton Actualiser
Le bouton `Actualiser` :
- recharge `Team`, `Team_ref`, `Motifs_RH`, `Presences` et `Parametres_Alertes` depuis Grist ;
- vide les modifications locales non enregistrées de la grille de saisie en masse ;
- rafraîchit explicitement le calendrier, les filtres, les motifs, les prévisions, les rapports et les alertes ;
- affiche un état `Actualisation…` pendant le rechargement.

Les données déjà enregistrées dans Grist ne sont évidemment pas supprimées.


## V3.9
Le bloc Actions de la saisie en masse a été déplacé après les blocs Import Excel/CSV et immédiatement au-dessus de la feuille de temps.


## V4 — Menu Imports dédié
Les blocs `Import Excel en masse` et `Import CSV en masse` ont été retirés de `Saisie des temps`.
Un nouveau menu principal `Imports` regroupe les deux fonctions d'import, leurs analyses, prévisualisations et boutons de réinitialisation.
La vue `Saisie des temps` reste dédiée à la saisie manuelle : filtres, motifs, actions et calendrier.


## V4.1 — Aide sur les motifs
Dans `Saisie des temps`, un bouton `ⓘ Motifs disponibles` ouvre un panneau compact.
Le contenu est alimenté dynamiquement depuis `Motifs_RH` :
- code ;
- libellé ;
- couleur.
Le panneau peut être refermé pour conserver un maximum d'espace au calendrier.


## V4.2 — Correction de la page Saisie des temps
Correction de la structure HTML du bloc Actions qui avait été cassée lors de son déplacement :
- les boutons Actions sont de nouveau contenus dans leur carte ;
- la carte Actions est placée juste au-dessus du calendrier ;
- les trois boutons sont disposés horizontalement ;
- le calendrier n'est plus imbriqué dans le bloc Actions ;
- le panneau Motifs reste dans le bloc de sélection des motifs.


## V4.3 — Correction Actualiser / erreur `innerHTML of null`
La cause était un ancien rendu `renderLegend()` toujours appelé alors que la légende permanente avait été supprimée de la page.
Le rendu global a été corrigé et les fonctions de rendu de la saisie en masse ont été sécurisées lorsqu'un élément DOM est absent.


## V4.4 — Correction `renderRecent is not defined`
Le code utilisait deux noms différents pour la même fonction de rendu des rapports :
- `recent()`
- `renderRecent()`

La V4.4 utilise désormais uniquement `renderRecent()` et la fonction est sécurisée si le tableau `recent` n'est pas présent dans la vue.


## V4.5 — CSV Excel plus robuste
Le moteur CSV accepte désormais :
- UTF-8 avec ou sans BOM ;
- Windows-1252 / ANSI, fréquent avec Excel Windows ;
- dates `AAAA-MM-JJ` ;
- dates `JJ/MM/AAAA` ;
- également `JJ-MM-AAAA` et `JJ.MM.AAAA`.

Toutes les dates sont normalisées en interne vers `AAAA-MM-JJ` avant comparaison et import dans Grist.


## V4.6 — Intitulés des écrans
Les titres ont été harmonisés et rendus distincts :
- Cockpit RH
- Prévisionnel
- Saisie de masse
- Imports
- Alertes
- Rapports

L'ancien intitulé redondant `Saisie des temps — Saisie de masse` a été supprimé.
Le menu `Imports` possède désormais également son propre titre et sous-titre.


## V4.7 — Intitulé Saisie des temps
Le menu et le titre de la vue `saisie` utilisent désormais `Saisie des temps`.
La notion de saisie de masse reste une fonctionnalité de cet écran et non son intitulé.


## V4.8
Correction complète de l'import CSV Excel : dates françaises/ISO et statuts/encodages Excel normalisés avant validation.


## V4.9 — Taux de présence RH corrigé
Calcul :
`présence équivalente / jours-ressources travaillables × 100`

- P, TL, TE, TLE, FO : présence selon `Presence_Equivalent`
- A : absence
- 1/2 M et 1/2 AM : 0,5 présence / 0,5 absence
- WE et F : exclus du dénominateur
- tout motif avec `Compte_Capacite = false` : exclu
- libellé explicite `jours-ressources travaillables`


## V5 — Passage en masse des jours passés en Réalisé
Dans l'écran `Prévisionnel`, un bloc de régularisation permet :
- de compter les lignes de `Presences` dont la date est strictement antérieure à aujourd'hui ;
- de ne sélectionner que celles avec `Statut = Prévisionnel` ;
- de basculer toutes ces lignes en `Réalisé` en une seule action ;
- de demander confirmation avant écriture ;
- de recharger le cockpit après mise à jour.

Les lignes futures, les lignes `Confirmé` et les lignes déjà `Réalisé` ne sont pas modifiées.

## V5.1 — Bulles explicatives des KPI
Ajout d'une icône `ⓘ` à côté de Taux de présence, Absence, Télétravail et Formation. Les bulles expliquent la formule, les motifs pris en compte et les exclusions. Elles sont accessibles au survol et au focus clavier.


## V5.2 — Réinitialisation complète de la feuille de temps d'une ressource
Dans `Saisie des temps`, un bloc permet de sélectionner une ressource et de supprimer toutes ses lignes dans `Presences`.

Sécurité :
- le nombre de lignes à supprimer est affiché avant l'action ;
- double confirmation ;
- seule la table `Presences` est concernée ;
- la ligne correspondante dans `Team` n'est jamais supprimée ;
- l'équipe et les allocations PMO ne sont pas modifiées.

La suppression utilise `TableOperations.destroy(recordIds)` de l'API Grist.


## V5.3 — Réinitialisation totale ou sur une période
La réinitialisation d'une feuille de temps propose maintenant deux portées :
- `Toute la feuille de temps`
- `Une période donnée`

En mode période, les dates `Du` et `Au` sont obligatoires.
Le compteur affiche uniquement les lignes de `Presences` qui seront supprimées.
La suppression reste limitée à `Presences` : la ressource `Team` et son équipe ne sont jamais supprimées.


## V5.4
Réinitialisation déplacée dans une modale ouverte depuis Actions. Liste des ressources alimentée directement depuis Team, sans filtre équipe/actif.


## V5.5
Contrôle d'affichage des motifs dans la grille : visible/masqué par motif, Tout afficher, Tout masquer. Le masquage est seulement visuel et ne modifie pas Presences.


## V5.6
Correction fermeture modale : croix, Annuler, clic hors modale et touche Échap. Forçage display:none à la fermeture.
