# V6.58 — demandes auto-validables visibles et temporisation

- Les demandes `EN_ATTENTE` avec `AutoValidation=true` restent visibles dans **Demandes RH** pendant le délai configuré.
- Elles affichent un badge `Auto-validation · N s`.
- Le manager/PMO peut cliquer **Valider maintenant** pour déclencher immédiatement la même logique métier que la validation normale.
- Le manager peut également **Refuser** la demande avant l'échéance.
- À l'échéance, si la demande est toujours `EN_ATTENTE`, l'auto-validation exécute `approvedPresenceActions()` puis passe la demande à `VALIDEE`.
- Le délai est stocké dans `PARAM_DEMANDES_RH` :
  - `Cle = DELAI_AUTO_VALIDATION_SECONDES`
  - `Valeur = nombre de secondes`
  - `Actif = true`
- Valeur par défaut si le paramètre/table n'existe pas : **15 secondes**.
- Une carte d'administration réservée aux admins est ajoutée dans l'onglet **Demandes RH** pour modifier ce délai. Le widget Administration RH séparé n'étant pas présent dans le package source fourni, son interface n'a pas été modifiée ici.
- Le contrôle périodique tourne toutes les 5 secondes : l'exécution effective intervient donc à l'échéance avec une tolérance maximale d'environ 5 secondes tant que le widget Cockpit est ouvert.
