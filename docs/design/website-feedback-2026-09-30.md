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
| Réinitialisation du mot de passe lente | Parcours vérifié côté code (20 tests verts) ; délai de livraison non reproduit ; proposition visuelle à valider |
| Références : limites d’import peu visibles | Proposition à valider : une ligne de limites dans la fenêtre d’import, par type de média |

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

## Propositions restantes — non intégrées

La maquette des références utilise les contrôles existants avec une seule ligne
visible de formats, taille par fichier et durée totale. Les conseils supplémentaires
restent repliés. Les formats audio de la fixture Wan sont WAV et MP3, conformément
à la [documentation Alibaba du 28 septembre 2026](https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference).
Elle confirme cinq clips au maximum, 15 secondes cumulées et 15 Mo par fichier.
L’affirmation « WAV uniquement » du feedback ne correspond pas à cette source.
Avant intégration, dériver les indications des contraintes du champ et du mode :
le fallback actuel annonce M4A pour Wan et l’aide image peut reprendre le plafond
vidéo du mode (100 Mo) au lieu du plafond image du champ (20 Mo). Les valeurs
vérifiées sont explicites dans la fixture ; elles ne sont pas encore des changements
de catalogue ou de validation. Le prix de la fixture de références est illustratif,
et aucun bouton de cette fixture ne lance de génération.

La demande de réinitialisation attend la réponse de Supabase, sans timer de délai
volontaire. Les tests existants de demande, de récupération et de continuité de
langue passent (20 tests). Le délai de livraison d’email reste non diagnostiqué
sans logs Auth/SMTP ; aucun email ni changement de mot de passe n’a été effectué.
La proposition visuelle supprime les onglets de connexion/inscription en mode reset,
affiche un spinner dans le bouton pendant l’envoi et une confirmation courte avec
le statut accessible après acceptation. Les états sont simulés, pas une preuve de
livraison réelle.

L’aperçu local contient trois onglets : Accueil (anglais), Références et Mot de passe.
Les nouveaux fichiers de maquette sont hors du dépôt. Le header anglais a été
vérifié à 390 × 844 (deux actions de 44 px, pas de débordement horizontal). Les états
d’envoi et de confirmation, ainsi que la fenêtre audio, ont aussi été inspectés sur
mobile. Ces deux propositions restent hors des sources produit, en attente de
validation de leur visuel.
