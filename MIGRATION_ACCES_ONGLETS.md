# V6.25 — Paramétrage de l'accès fin aux onglets

## Principe

Les deux onglets sensibles sont désormais pilotés **exclusivement** par `ACCES_ONGLETS`.

Le statut Owner Grist ou Admin RH ne donne plus automatiquement accès à ces deux onglets.

Codes à utiliser :
- `ALERTES` pour l'onglet Alertes opérationnelles ;
- `ALERTES_ANNUELLES` pour l'onglet Alertes annuelles.

Chaque utilisateur, y compris un administrateur, doit disposer de la ligne active correspondante s'il doit ouvrir l'onglet.

## Table Grist à créer : `ACCES_ONGLETS`

Colonnes recommandées :

| Colonne | Type Grist | Valeur |
|---|---|---|
| `Module` | Ref vers la table de modules, ou Texte | `COCKPIT_RH` |
| `Onglet` | Texte / Choice | `ALERTES` |
| `Team` | Ref vers `Team` | collaborateur autorisé |
| `Actif` | Toggle | vrai/faux |
| `Commentaire` | Texte | facultatif |

Le widget accepte aussi les alias techniques suivants pour faciliter une migration :
- Onglet : `Onglet`, `Code_Onglet`, `Onglet_Code`, `Tab`, `Vue`
- Module : `Module`, `Module_Code`, `Code_Module`, `Acces_Module`
- Team : `Team`, `Ressource`, `Utilisateur`, `Collaborateur`, `Team_Id`
- Actif : `Actif`, `Active`, `Enabled`

## Résolution du module

`Module` peut contenir directement `COCKPIT_RH`, ou être une référence vers une ligne portant ce code dans :
- `ACCES_MODULE`
- `ACCES_MODULES`
- `DROITS_MODULES`

## Règle d'accès

Pour chaque onglet :
- ligne active `COCKPIT_RH / <CODE_ONGLET> / Team / Actif=true` : accès autorisé ;
- aucune ligne active correspondante : accès refusé.

Les droits sont indépendants : une personne peut avoir `ALERTES` sans `ALERTES_ANNUELLES`, l'inverse, les deux, ou aucun.

Les ACL Grist restent la sécurité réelle des données.

## V6.27 — Références Grist

Le contrôle accepte maintenant explicitement les références Grist renvoyées sous forme `["R", id]` ainsi que les identifiants numériques.

La configuration recommandée correspond donc directement à :
- `Module` : colonne **Ref** vers la table de modules ;
- `Team` : colonne **Ref** vers `Team`, avec l'email comme colonne d'affichage ;
- `Onglet` : `ALERTES` ou `ALERTES_ANNUELLES` ;
- `Actif` : coché.

La comparaison d'autorisation se fait sur l'identifiant réel de la ligne référencée, et non sur le texte affiché dans la cellule.
