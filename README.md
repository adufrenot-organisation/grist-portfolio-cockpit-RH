# Widget Opérations RH/PMO V2

Utilise directement les tables du modèle PMO unifié :

- `Team`
- `Motifs_RH`
- `Presences`
- `Parametres_Alertes`

`Presences.Ressource` est une référence Grist vers `Team`.
`Presences.Motif` est une référence Grist vers `Motifs_RH`.

Le widget nécessite Full document access pour saisir/modifier les présences.
