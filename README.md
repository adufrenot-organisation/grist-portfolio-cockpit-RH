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
Le bloc Actions de la saisie en masse a été déplacé après les blocs Import Excel/CSV et immédiatement au-dessus de la feuille de présence.


## V4 — Menu Imports dédié
Les blocs `Import Excel en masse` et `Import CSV en masse` ont été retirés de `Feuille de présence`.
Un nouveau menu principal `Imports` regroupe les deux fonctions d'import, leurs analyses, prévisualisations et boutons de réinitialisation.
La vue `Feuille de présence` reste dédiée à la saisie manuelle : filtres, motifs, actions et calendrier.


## V4.1 — Aide sur les motifs
Dans `Feuille de présence`, un bouton `ⓘ Motifs disponibles` ouvre un panneau compact.
Le contenu est alimenté dynamiquement depuis `Motifs_RH` :
- code ;
- libellé ;
- couleur.
Le panneau peut être refermé pour conserver un maximum d'espace au calendrier.


## V4.2 — Correction de la page Feuille de présence
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

L'ancien intitulé redondant `Feuille de présence — Saisie de masse` a été supprimé.
Le menu `Imports` possède désormais également son propre titre et sous-titre.


## V4.7 — Intitulé Feuille de présence
Le menu et le titre de la vue `saisie` utilisent désormais `Feuille de présence`.
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


## V5.2 — Réinitialisation complète de la feuille de présence d'une ressource
Dans `Feuille de présence`, un bloc permet de sélectionner une ressource et de supprimer toutes ses lignes dans `Presences`.

Sécurité :
- le nombre de lignes à supprimer est affiché avant l'action ;
- double confirmation ;
- seule la table `Presences` est concernée ;
- la ligne correspondante dans `Team` n'est jamais supprimée ;
- l'équipe et les allocations PMO ne sont pas modifiées.

La suppression utilise `TableOperations.destroy(recordIds)` de l'API Grist.


## V5.3 — Réinitialisation totale ou sur une période
La réinitialisation d'une feuille de présence propose maintenant deux portées :
- `Toute la feuille de présence`
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


## V5.7 — Sélectionner les motifs à masquer
Le contrôle de visibilité utilise désormais un second sélecteur visuel, cohérent avec le bloc `Sélectionner le motif à appliquer`.
Chaque motif apparaît sous forme de tuile colorée avec code, libellé et état `Visible/Masqué`.
Un motif masqué est grisé et barré.


## V5.8 — Interface motifs rationalisée
- Le bloc `Motif à appliquer` ne contient plus les options de masquage.
- Le bloc `Motifs affichés dans la grille` est désormais une carte séparée.
- La légende / aide `Motifs disponibles` redondante a été retirée de cette zone.
- Les deux fonctions ont des rôles distincts : affecter un motif vs contrôler son affichage.


## V6 — Verrouillage / déverrouillage des périodes
Le Cockpit utilise une table optionnelle `Verrous_Periodes_RH`.

Une période verrouillée :
- est grisée avec un cadenas dans la grille ;
- ne peut pas être modifiée manuellement ;
- bloque les lignes d'import CSV/Excel correspondantes ;
- bloque une réinitialisation de feuille de présence qui touche cette période ;
- est exclue du passage automatique Prévisionnel -> Réalisé.

Le déverrouillage est manuel et passe `Verrouille` à `false`, sans supprimer la ligne.

Les contrôles de verrouillage/déverrouillage sont désactivés si le widget n'a pas l'accès `full`. Les droits Grist du document restent également applicables.

Important : ceci protège les opérations du Cockpit. Pour bloquer aussi les modifications directes dans les tables Grist, il faut ajouter des règles ACL Grist.


## V6.1 — Correctif bouton Verrouiller
- le bouton n'est plus désactivé sur la base d'une détection d'accès Grist incertaine ;
- Grist reste l'autorité réelle : un utilisateur sans droit d'écriture verra l'écriture refusée par l'API ;
- le bouton affiche `Verrouillage…` pendant l'opération ;
- un diagnostic visible indique succès ou erreur ;
- après création, la ligne est relue depuis `Verrous_Periodes_RH` pour confirmer l'écriture.


## V6.2 — Correctif verrouillage + version visible
- Le bouton `Verrouiller la période` n'est plus rendu inactif à partir d'un état de table potentiellement obsolète.
- Au clic, le widget revérifie `Verrous_Periodes_RH` directement dans Grist.
- L'état d'écriture est affiché dans la modale : vérification, écriture, succès ou erreur.
- Après écriture, le widget recharge la table et vérifie que le verrou existe réellement.
- La version `V6.2` est visible en bas du menu gauche, sous l'état de synchronisation.


## V6.3 — Correctif bouton Verrouiller
Cause identifiée : `app.js` était chargé avant le HTML des modales. Les boutons internes aux modales n'existaient donc pas encore lors de l'installation de leurs événements.

Correction :
- chargement de `app.js` déplacé après les modales ;
- bouton `Verrouiller la période` correctement lié ;
- boutons de fermeture/déverrouillage/reset sécurisés par le même ordre DOM ;
- version visible passée à V6.3 ;
- listener délégué de secours ajouté pour le verrouillage.


## V6.4 — Initialisation d'un calendrier
Nouvelle action `📅 Initialiser une feuille de présence` dans le bloc Actions.
- ressource au choix ;
- année entière ou plage Du/Au ;
- motif jours ouvrés, par défaut P ;
- motif week-end, par défaut WE ;
- statut au choix ;
- aucune saisie existante n'est écrasée ;
- les périodes verrouillées sont ignorées.
Les jours fériés ne sont pas détectés automatiquement dans cette version.


## V6.5 — Initialiser ou modifier en masse un calendrier
La modale propose maintenant deux modes :

### Initialiser les jours manquants uniquement
- crée uniquement les dates absentes de `Presences` ;
- ne modifie aucune saisie existante.

### Modifier en masse le calendrier
- crée les dates manquantes ;
- met à jour les dates déjà renseignées avec les motifs choisis et le statut sélectionné ;
- ignore toujours les périodes verrouillées.

Option activée par défaut :
`Préserver les jours déjà renseignés avec le motif F`.

La prévisualisation distingue :
- créations ;
- mises à jour ;
- jours verrouillés ignorés ;
- jours existants conservés.


## V6.6 — Terminologie Feuille de présence
Renommage fonctionnel global de l'interface :
- `Saisie des temps` devient `Feuille de présence` ;
- `Réinitialiser une feuille de temps` devient `Réinitialiser une feuille de présence` ;
- l'action calendrier devient `Initialiser / modifier une feuille de présence` ;
- les libellés visibles associés utilisent désormais la terminologie présence / absence.

Les noms techniques Grist, notamment la table `Presences`, ne sont pas modifiés afin de préserver la compatibilité avec la base existante.


## V6.7 — Alertes retirées du Cockpit
Le bloc Alertes a été supprimé de la page Cockpit RH. Les alertes restent disponibles dans l'onglet Alertes. Le moteur de calcul et les seuils ne sont pas modifiés.


## V6.8 — Pilotage enrichi
Ajout capacité/seuil CAP_MIN, présence physique, taux de télétravail, ressources sous seuil, répartition d'activité, prévisionnel vs réalisé hebdomadaire et points d'attention.


## V6.9 — Feuille de présence en fenêtres de 15 jours
- Le bloc Actions devient responsive : les boutons se répartissent automatiquement sur plusieurs colonnes et ne débordent plus à 100 % de zoom.
- `Réinitialiser une feuille de présence` peut revenir à la ligne si nécessaire.
- La grille n'affiche plus tout le mois simultanément.
- Fenêtre 1 : jours 01 à 15.
- Fenêtre 2 : jours 16 à la fin du mois.
- Les flèches précédent/suivant naviguent entre les deux fenêtres, puis changent de mois.
- `Tout sélectionner` agit uniquement sur les jours visibles de la fenêtre courante.
- Le titre indique explicitement la plage, par exemple `Août 2026 · 01–15`.


## V6.10 — Correctif Actualiser
Le bouton `Actualiser` appelait encore `renderAlerts()`, une ancienne fonction qui n'existe plus dans le module.
Le rendu actuel utilise `alerts()` via le `render()` principal.

Le rafraîchissement a été simplifié :
- recharge des données Grist via `load()` ;
- `load()` déclenche le rendu global ;
- suppression des appels redondants à d'anciennes fonctions de rendu ;
- conservation des rendus complémentaires de la feuille de présence.


## V6.11 — Version visible
Le numéro de version est maintenant affiché explicitement en bas du menu gauche, sous l'état de synchronisation :
`Cockpit RH · V6.11`.


## V6.12 — Menu gauche réductible
- Le menu gauche est réduit par défaut.
- Un bouton rond permet de l'ouvrir / le refermer à tout moment.
- L'état est mémorisé localement dans le navigateur.
- En mode réduit, le menu occupe environ 72 px et libère davantage d'espace pour la feuille de présence et les graphiques.
- Les entrées principales restent accessibles sous forme d'icônes compactes avec infobulle au survol.
- La version reste disponible lorsque le menu est déplié.


## V6.13 — Menu compact réel + quinzaine sans scroll
- Le `#app` passe réellement de 210 px à 72 px quand le menu est replié : la zone centrale récupère donc toute la largeur libérée.
- Les anciennes pseudo-icônes du menu réduit ont été remplacées par de vraies icônes avec infobulles propres.
- Les libellés du menu ne se superposent plus en mode réduit.
- La feuille de présence utilise `table-layout: fixed` et 100 % de la largeur disponible.
- Les colonnes Ressource/Équipe sont compactées et les 15 jours se répartissent automatiquement sur l'espace restant.
- À partir d'une largeur tablette étroite seulement, le scroll horizontal redevient disponible comme solution de secours.


## V6.14 — Présence v2
Intégration du heartbeat partagé `SESSIONS_UTILISATEURS` avec module `Cockpit RH` et contexte selon l'écran actif.


## V6.15 — reprise depuis la dernière version utilisateur
Cette version repart du ZIP fourni comme nouvelle base de référence.

Modifications ajoutées :
- statut visuel 🟢 / 🟠 / 🔴 sur Capacité disponible ;
- seuils Orange/Rouge affichés directement sous la valeur ;
- Présence physique évaluée en % avec référence recommandée 50 % / 35 % ;
- compatibilité avec l'ancien PRES_PHY exprimé en personnes ;
- taux de télétravail marqué comme indicateur informatif ;
- ressources sous seuil avec statut `Aucun` / `À examiner` ;
- alertes PRES_PHY calculées en pourcentage de l'effectif actif.
