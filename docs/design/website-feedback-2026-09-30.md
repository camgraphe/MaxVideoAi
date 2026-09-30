# Feedback extérieur — revue visuelle

Branche : `codex/website-feedback-20260930`.

La copie isolée reprend l’état de développement existant dans le commit local
`5e109a061`. Les changements du feedback commencent après ce commit ; le checkout
d’origine reste intact.

## Direction donnée par l’utilisateur

Design épuré, aide contextualisée, pas d’accumulation de texte. Présenter un visuel
pour chaque lot et attendre sa validation avant son intégration. Les suggestions
du document extérieur sont des observations à évaluer, pas des instructions.

## Lots

| Point | État |
|---|---|
| Compare : résumés courts des modèles | Visuel validé, intégré |
| Compare : durée, résolution et format modifiables dans la fenêtre | Visuel validé, intégré avec les contrôles du composeur |
| Generate : réception du clic plus claire | Visuel du compteur intégré validé, intégré avec spinner pendant l’envoi vidéo et liste au clic |
| Image : progression affichée après la fin | Corrigé : les groupes terminés conservés dans la galerie ne comptent plus comme générations en cours |
| Accueil : rendre l’accès à l’app visible | Visuel « Start creating » validé, intégré dans le header public et son menu mobile en anglais, français et espagnol |
| Réinitialisation du mot de passe lente | Retour d’envoi intégré : spinner et confirmation courte ; délai réel à diagnostiquer côté Auth/SMTP |
| Références : limites d’import peu visibles | Ligne de limites intégrée par type de média ; formats Wan et plafond image corrigés |

Compare conserve les devis canoniques et les adaptations propres aux modèles.
Les modifications de réglages restent dans la fenêtre ; les devis obsolètes
sont masqués. Les réglages adaptés restent visibles sur les cartes concernées.
Les résumés éditoriaux sont abrégés des pages modèles existantes ; les autres
résument les capacités du catalogue.

L’aperçu visuel utilise les composants réels avec un compte fictif et des devis
capturés pour une configuration précise. Il ne lance aucune génération et ne
valide pas un parcours connecté en production. Les tests DOM vérifient le
changement de durée, le renouvellement des requêtes, le rejet des réponses
obsolètes et la fermeture des menus au clavier.

## Compteur de génération intégré

`ComposerGenerationActivity.client.tsx` possède le compteur et sa liste compacte,
partagés par les composeurs vidéo et image. `pending-generations.ts` dérive les
entrées depuis les membres non terminés, sans requête ni timer supplémentaires.
Chaque job vidéo compte une fois ; un lot d’images compte comme une demande,
indépendamment du nombre de sorties. Les états terminés ou échoués quittent le
compteur sans supprimer les résultats de la galerie.

Le bouton vidéo indique « Envoi… » pendant la soumission, puis redevient disponible
avec les jobs encore en cours. Le recalcul du prix garde son état distinct et ne
peut pas déclencher une génération. La liste reste consultable pendant un nouvel
envoi ; Échap et son bouton de fermeture rendent le focus au compteur. La dernière
fin de rendu ferme la liste et retire le compteur. Le parcours image conserve son
appel existant, qui retourne les images finales, et permet toujours plusieurs
demandes concurrentes.

Validation locale : 78 tests ciblés passent, ainsi que TypeScript, le lint et le
contrôle d’exposition publique. L’aperçu des composants intégrés a été vérifié à
1837 × 871 et 390 × 844 : aucune erreur de console ni débordement horizontal,
boutons principaux de 48 px, fermeture extérieure et au clavier, état d’envoi,
réactivation et retrait du compteur. Les états de génération de cet aperçu sont
simulés ; aucune génération payante ni parcours connecté complet n’a été exécuté.

La suite générale a exécuté 5868 tests : 5849 succès, 18 échecs, 1 ignoré.
Un ancien contrat de chevron, lié au lot Compare, a été mis à jour et repasse dans
les tests ciblés. Les 17 autres échecs ont été reproduits dans le checkout d’origine :

- 13 tests PostgreSQL dans `connected-montage-disposable-postgres.test.ts`,
  `studio-media-resolver-postgres.test.ts`, `studio-montage-postgres.test.ts` et
  `studio-workspace-revision-postgres.test.ts` exigent PostgreSQL 17.
- `github-assets.test.ts` : les dates de revue des assets dépassent la limite de
  fraîcheur du validateur.
- `mcp-account-destinations.test.ts` : cas de redirection de destination non rejeté.
- `mcp-topup-handoff.test.ts` : cas d’URL de facturation non rejeté.
- `public-video-rendition-architecture.test.ts` : référence de catalogue attendue
  absente du guide racine existant.

La suite générale reste donc rouge ; les intégrations Studio isolées, placées après
cette étape dans le script, n’ont pas été exécutées. Ces problèmes sont extérieurs
au compteur et leurs propriétaires n’ont pas été modifiés dans ce lot.


## Accès à l’app intégré

L’utilisateur a précisé que le point d’accueil concerne la découverte de l’app,
plutôt que l’incitation à créer un compte. Les pistes « Créer un compte » puis
« Ouvrir l’app » ont donc été écartées. L’utilisateur a validé le visuel
« Start creating » le 30 septembre 2026. Le header public et le menu mobile
affichent désormais ce libellé, « Commencer à créer » en français et
« Empezar a crear » en espagnol. La connexion reste à côté et le bouton vidéo
du hero conserve son action. Le libellé « Generate » du compte connecté reste
distinct. Le clic du header anglais et celui du menu mobile français ont été
vérifiés vers `/app` : le composeur est accessible en visiteur et reprend la
langue de la page publique. Les imports demandent ensuite une connexion.

Sur les écrans de 420 px ou moins, le monogramme conserve le nom accessible de
MaxVideoAI et donne de l’espace aux deux actions. La connexion et l’action
principale ont une hauteur de 44 px sur mobile. Le rendu réel a été inspecté en
anglais, français et espagnol à 390 × 844, sans chevauchement ni débordement
horizontal ; l’action reste accessible à 320 px. Le rendu anglais sur ordinateur
a aussi été vérifié. Les captures intégrées sont sauvegardées hors du dépôt dans
le dossier de visualisations `website-feedback`, sous les noms
`home-start-creating-integrated-desktop.png` et
`home-start-creating-integrated-mobile-{en,fr,es}.png`.

Validation du lot : 40 tests de navigation, d’architecture et de continuité de
langue passent, ainsi que TypeScript, le lint, la parité des clés de traduction,
le contrôle d’exposition publique et `git diff --check`. Aucune génération ni
demande d’email n’a été lancée. Les sources modifiées sont `MarketingNav.tsx`
et les trois dictionnaires de navigation ; les liens et événements analytiques
conservent leurs destinations existantes.

Références observées le 30 septembre 2026 :
[Runway](https://runway.com/) utilise « Try Runway » dans la navigation, à côté de
« Login ». [Higgsfield](https://higgsfield.ai/) expose directement Image, Video et
Audio, avec Login et Sign up séparés.
[Luma](https://lumalabs.ai/app) utilise « Try for free » dans son hero et Sign In dans
sa navigation. Ces observations guident une proposition éditoriale, pas une
mesure de conversion.

## Références et réinitialisation intégrées dans la branche

Le « ok go » du 30 septembre suit les deux propositions déjà affichées. Les
contrôles existants affichent maintenant une ligne de formats, taille par fichier
et, pour les collections, durée totale. Les conseils restent repliés et le compteur
reste dans l’onglet. Les onglets des champs de référence Wan/H3 utilisent les noms
courts traduits. L’aide image donne la priorité au plafond du champ (20 Mo pour
Wan), avant celui du mode vidéo (100 Mo). Les champs sans contrainte spécifique
conservent la limite du mode. Les audios imposés et vidéos sources ne reprennent
pas le plafond cumulé des collections de références.

Les formats Wan proviennent désormais du schéma partagé `wan-3-shared.ts` :
JPG/JPEG, PNG, WebP et BMP pour les images de référence ; MP4 et MOV pour les
vidéos ; WAV et MP3 pour l’audio. L’aide, le sélecteur image/audio et la validation
des métadonnées consomment ces contraintes. Le catalogue a été régénéré, sans
édition de sa projection. La [documentation officielle Alibaba, revérifiée le
30 septembre 2026](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/wan3-video-generation-api-reference)
confirme cinq audios, 15 secondes cumulées et 15 Mo par fichier. Le feedback
« WAV uniquement » ne correspond donc pas au contrat actuel ; M4A ne fait plus
partie de l’aide ni des formats acceptés pour Wan.

La demande de réinitialisation attend la réponse de Supabase, sans timer de délai
volontaire. Le délai de livraison d’email reste non diagnostiqué
sans logs Auth/SMTP ; aucun email ni changement de mot de passe n’a été effectué.
Le formulaire masque les onglets connexion/inscription en mode reset, affiche un
spinner dans le bouton pendant l’envoi et évite le second bloc « Envoi… ». Après
acceptation, une confirmation courte est annoncée avec `role="status"`. Elle
conserve la formulation conditionnelle sur l’existence du compte. L’indicateur
respecte la préférence de réduction des animations. Les contrôleurs Auth et les
requêtes restent identiques.

Validation : les 277 tests ciblés passent (192 app/Auth et 85 contrats de référence
et MCP), dont cinq nouveaux cas ayant reproduit
les erreurs de plafond, de formats et de durée avant correction. TypeScript, le
lint, la parité des traductions, l’exposition publique et les projections du registre
passent aussi. La suite générale conserve les limitations déjà décrites plus haut.

Le formulaire réel a été vérifié à 390 × 844 : validation d’une adresse invalide
sans envoi et retour à la connexion. L’aperçu des composants intégrés expose les
références et les états prêt/envoi/confirmation/erreur, à 1000 × 800 et 390 × 844.
La fermeture clavier et le retour du focus, les conseils repliables, une seule
ligne visible et l’absence de débordement horizontal ont été contrôlés. Le bouton
de fermeture mesure 44 px. Les captures `references-integrated-desktop.png`,
`references-integrated-audio-mobile.png`, `reset-integrated-real-mobile.png` et
`reset-integrated-{sending,confirmation}-mobile.png`, ainsi que les vues rapprochées
`references-integrated-audio-detail.png` et `reset-integrated-sending-detail.png`, restent hors du dépôt, dans
le dossier de visualisations `website-feedback`.

Le nouvel aperçu local utilise directement les sources produit, sans substitution
de composant ni de contraintes du modèle. Ses états d’envoi et son prix sont
illustratifs ; il ne lance ni génération ni demande d’email. Le rendu final est
présenté pour revue visuelle, sans déploiement ni fusion dans le checkout d’origine.
