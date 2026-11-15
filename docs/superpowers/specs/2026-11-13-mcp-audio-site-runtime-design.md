# Audio MCP — réutilisation explicite du chemin du site

Le propriétaire demande le même chemin, les mêmes fournisseurs et les coûts déjà validés du site. Aucun service permanent supplémentaire n'est autorisé. Les enveloppes ponctuelles 10 USD infrastructure et 5 USD médias sont acceptées ; aucune dépense ni activation ne fait partie de ce changement local.

Le site appelle `generateAudioRun`, qui réserve puis appelle `executeReservedAudioRun`. La confirmation MCP réserve elle aussi avec le propriétaire commun mais l'extension Audio ajoute actuellement systématiquement `enqueueAudioDispatch`. Le choix de transport, et non le moteur/provider/pricing, doit être explicite.

Approches : un serveur Audio permanent est écarté comme choix imposé. Un nouveau cron/after serait une autre architecture et ne retire pas la limite de durée. Le mode **site**, retenu suivant la demande du propriétaire, utilise directement l'exécuteur existant après réservation MCP ; le mode **worker** reste compatible pour un éventuel hébergement qualifié séparément. On conserve les sept packs, les contrôles de publication/provider, le devis exact, les scopes OAuth et l'idempotence. Aucun changement de prix, de génération native web ou de schéma.

Configuration : `MCP_AUDIO_EXECUTION_MODE=site` avec `MCP_AUDIO_EXTENDED_ENABLED=true` autorise le catalogue étendu sans exiger le worker. Mode absent ou `worker` conserve strictement le comportement actuel et exige `AUDIO_GENERATION_WORKER_ENABLED=true`. Une valeur inconnue n'ouvre pas l'extension. La révision de catalogue distingue les deux chemins ; un devis d'un mode ne traverse pas l'autre.

Le site et la route MCP déclarent déjà 800 secondes. La qualification locale prouve le routage et les garanties existantes, pas la durée réelle des fournisseurs ni les limites du client ChatGPT. Certains budgets de timeout cumulés dépassent 800 secondes : aucune garantie nouvelle de traitement illimité, de récupération automatique après arrêt forcé, ou de coût d'hébergement nul n'est annoncée. Les cas longs doivent être qualifiés sur le test avant d'activer le mode site ; si nécessaire, l'exécution à la demande sur l'infrastructure média existante sera examinée sans revenir à un serveur permanent imposé.

Travail dans le checkout isolé existant sur une branche locale distincte ; PR 650 et production restent inchangées. L'exécution locale continue selon la consigne antérieure du propriétaire de ne pas s'arrêter entre lots ; les choix de production et opérations facturables restent soumis à son accord.
