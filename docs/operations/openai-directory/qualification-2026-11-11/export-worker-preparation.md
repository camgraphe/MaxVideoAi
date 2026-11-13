# Export Studio dédié — qualification du 11 novembre

La stack `maxvideoai-openai-review-export-20261111` est créée à Francfort, puis
mise à jour sur le digest Linux AMD64 effectivement publié :
`sha256:29e983fa93ddef03ac7195755c03495719c25f213f4c1143b20a7949b3922659`.
L’image vient de l’archive Git du commit
`ebbd1ac54937f6b0aa104df4bf393ad8125a6a33`, sans checkout Desktop ni fichier privé.

## Résultats observés

- ECR privé dédié : 1 041 625 838 octets pour le manifeste exécutable. Le premier
  tag contient seulement une attestation de provenance ; le tag `-amd64` et le
  digest ci-dessus sont ceux à utiliser. Aucun remplacement de tag immuable.
- Template : 13 ressources, réutilisation du dépôt ECR retenu de la première
  tentative, réseau dédié sans entrée, sortie TLS/PostgreSQL, logs sept jours,
  rôles, définition Fargate 2 vCPU / 4 GiB et lanceur. Aucun service permanent.
- Deux tentatives ont échoué sur les droits de configuration réseau. Après
  l’accord explicite, les quatre ressources de la première ont été supprimées ;
  la seconde s’est annulée complètement. La troisième est `UPDATE_COMPLETE`.
- Les droits temporaires de réparation ont été **détachés et supprimés**, versions
  comprises, après réussite. La liste d’attachement confirme leur absence.
- Trois SecureString dédiés sont installés : Neon test et paire S3 du worker.
  Le droit temporaire d’écriture de ces secrets a également été retiré.
- Le lanceur a sa propre clé conservée localement et huit variables installées
  uniquement dans `maxvideoai-openai-review-20261111`. Un nouveau build est
  nécessaire pour leur prise en compte par l’application.
- L’unique probe a démarré, lu l’ID fictif
  `openai-review-nonexistent-probe-20261111`, puis quitté avec **exit 0**. Le journal
  confirme « target export … is not queued ». Aucun export normal n’a été pris.

Un export média réel reste à démontrer. Une tâche ECS réussie à vide ne prouve pas
le rendu, le son ou le téléchargement final. Les ressources normales sont exclues.

## Coût et durée

Plafond approuvé : **1 € AWS**, dans les 20 € totaux, pour un probe et un export.
Tarifs officiels relus : 0,04656 USD/vCPU-heure et 0,00511 USD/GiB-heure à
Francfort, soit 0,11356 USD/heure de calcul pour cette tâche. IP publique, logs,
stockage et transferts s’ajoutent. ECR privé : 0,10 USD/Go-mois. Ce sont des
estimations, pas une facture. Aucun service ECS permanent ni NAT.

Preuves privées : `worker-build/`, `export-stack-image-ready.json`,
`worker-health-probe-final.json`, `worker-health-probe-messages.json`,
`worker-secret-installation.json`, `network-repair-policy-removed.json`,
`export-launcher-env-installation.json`, sous le dossier local ignoré.

Sources : [Fargate](https://aws.amazon.com/fargate/pricing/),
[catalogue Francfort](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/eu-central-1/index.json),
[ECR](https://aws.amazon.com/ecr/pricing/).
