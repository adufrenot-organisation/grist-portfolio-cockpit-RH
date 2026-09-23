# Migration V6.50 — Demandes RH

Le widget peut créer automatiquement les deux tables depuis l'onglet **Demandes RH** avec un compte administrateur.

## Managers_Equipes
- Equipe : Ref:Team_ref
- Manager : Ref:Team
- Manager_Email : Text
- Actif : Bool
- Commentaire : Text

## Demandes_RH
- Reference : Text
- Demandeur : Ref:Team
- Equipe : Ref:Team_ref
- Type : Text
- Date_Debut / Date_Fin : Date
- Motif : Ref:Motifs_RH
- Statut : Text (`EN_ATTENTE`, `VALIDEE`, `REFUSEE`, `ANNULEE`)
- Manager : Ref:Team
- Commentaire_Demandeur / Commentaire_Manager : Text
- Date_Demande / Date_Decision : DateTime
- UUID_Demande : Text

Après création, renseigner `Managers_Equipes` pour associer chaque équipe à son manager.
