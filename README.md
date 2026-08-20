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
