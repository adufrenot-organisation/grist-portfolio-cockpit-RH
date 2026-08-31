# V6.25 — Paramétrage de l'accès fin aux onglets

## Principe

Deux niveaux de contrôle sont appliqués :

1. **Droit module / Admin RH** : le contrôle existant `ADMIN_RH` reste prioritaire.
2. **Délégation nominative d'onglet** : un utilisateur non-admin peut ouvrir uniquement l'onglet `Alertes` s'il possède une ligne active dans `ACCES_ONGLETS`.

`Alertes annuelles` reste réservé aux administrateurs RH dans cette version.

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

- Owner Grist / Admin RH : accès à `Alertes` + `Alertes annuelles`.
- Non-admin avec ligne `COCKPIT_RH / ALERTES / Team / Actif=true` : accès à `Alertes` uniquement.
- Non-admin sans ligne active : accès refusé à `Alertes`.
- Une délégation d'onglet ne remplace pas les ACL Grist : les ACL restent la sécurité des données.
