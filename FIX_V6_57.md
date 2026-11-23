# Cockpit RH V6.57 — Auto-validation

Ajout de l’auto-validation de `Demandes_RH` lorsque `AutoValidation = true` et `Statut = EN_ATTENTE`.

La logique réutilise `approvedPresenceActions()` : aucun chemin métier parallèle n’est créé. Les verrous et doublons continuent donc de bloquer la validation.

Le traitement s’effectue au chargement du widget puis toutes les 15 secondes tant que le Cockpit est ouvert, dans le périmètre autorisé de l’utilisateur courant.

Une auto-validation laisse `Manager` vide et inscrit `Auto-validation automatique` dans `Commentaire_Manager`.

Cette version ne met en place aucun service serveur supplémentaire ni Automation Grist externe.
