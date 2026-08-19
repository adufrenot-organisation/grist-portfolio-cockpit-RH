# RH / PMO — Opérations V2.1

Correctifs V2.1 :
- diagnostic des tables Grist avant chargement ;
- indication du nombre de ressources et de présences chargées ;
- message explicite si `Team` est vide ;
- navigation et saisie conservées.

Tables : `Team`, `Motifs_RH`, `Presences`, `Parametres_Alertes`.


## Correctif V2.2 — fetchTable

`grist.docApi.fetchTable()` renvoie un objet orienté colonnes. La V2.2 le convertit en tableau de lignes avant utilisation, y compris pour les colonnes de référence.
