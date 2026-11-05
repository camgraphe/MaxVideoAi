# Qualification par modèle, mode et surface

État du 5 novembre 2026. Code testé n'implique pas disponibilité publique.
Tous les modèles ci-dessous sont fermés dans le registre ; aucun tarif client
nouveau n'a été confirmé en production. Les cases de parcours réel attendent
leur reçu, leur devis et l'original dans la bibliothèque du bon compte.

| Modèle / mode | Contrat local | API fournisseur | App réel | Studio réel | MCP réel | Tarif public | Média public |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Flash / t2v | testé | en attente | en attente | en attente | en attente | fermé | fermé |
| Flash / i2v | testé | en attente | en attente | en attente | en attente | fermé | fermé |
| Flash / ref2v | testé | en attente | en attente | en attente | en attente | fermé | fermé |
| Flare 2.6 / t2i | testé | I1 obtenu | en attente | en attente | en attente | fermé | fermé |
| Flare 2.6 / i2i | testé | en attente | en attente | en attente | en attente | fermé | fermé |
| Sunburst 2.6 / t2i | testé | I2 obtenu | en attente | en attente | en attente | fermé | fermé |
| Sunburst 2.6 / i2i | testé | en attente | en attente | en attente | en attente | fermé | fermé |

Les tests locaux couvrent limites, paramètres, refus avant devis, réservations et
reprise via doubles de provider et PostgreSQL jetable. Les fixtures Studio
valident la certification technique ; l'ouverture demeure conditionnée à l'accès,
aux tarifs et à une preuve du parcours. Le MCP client et ses 70 cas de sélection
ont passé leur contrôle ; la découverte sur un host installé est une preuve distincte.

I1 : OpenAI direct Flare, PNG 1024², high/high, une sortie, 279 tokens texte et
1 758 tokens de sortie ; coût liste calculé 0,054135 USD, facture inconnue.
I2 : même prompt via Sunburst, 279 tokens texte et 1 756 tokens de sortie ;
0,054075 USD liste, facture inconnue. Les reçus locaux et les originaux sont
conservés dans le répertoire de production de cette tâche. Aucun utilisateur
MaxVideoAI n'a été débité par ces appels de qualification fournisseur.
