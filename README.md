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
