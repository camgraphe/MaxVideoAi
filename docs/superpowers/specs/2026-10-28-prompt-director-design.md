# Prompt et Milo — conception du compositeur

Date : 28 octobre 2026. Branche : `codex/prompt-director-composer`.
Base : `main` / `origin/main` à `04e7c53190dc7791eda8012861e9de6c226d654b`.

Statut : proposition d'interface à relire avant intégration produit. L'étude et le principe d'une aide facultative ont été retenus ; les détails visuels ci-dessous sont les choix proposés par Codex. Le prototype HTML est une maquette autonome, avec réponses et références simulées. Il ne fait aucun appel API et ne remplace aucun composant de l'application.

## Revision 3 — long prompts and conversation space

This section supersedes the disclosure layout and thumbnail dimensions in revision 2. Keep the prompt collapsible, with its first two lines visible when collapsed. Place **Use prompt / Use script** in the header, outside the disclosure and outside the scrollable conversation. Applying never requires expanding or scrolling to the bottom of the prompt. Expanding reveals an editable, height-bounded text field without consuming the transcript's scroll area. Keep stale-draft warnings outside the collapsed content as well.

Reduce thumbnails to **32 × 32 px**, retaining 44 px-high reference targets. Give generation settings slightly stronger text and a subtle fill, without changing heading sizes. The prototype demonstrates these changes; real workspace-column sizing, mobile keyboard behavior and app integration remain to be verified in the product. See [revision 3 evidence](../../design/prompt-composer/REFINEMENT-3.md).

## Revision 2 — user feedback incorporated

The preview now uses **English throughout**. This section supersedes the first visual proposal where they differ.

- Use **Start image** and **End image** for frame roles. Other references use **Image 1, Image 2, Audio 1, Video 1**, numbered independently by media type. Start/end roles do not consume image-reference numbers.
- Do not show uploaded filenames in the composer. Use the short identity as the primary and only label. Keep filenames in optional details in the future product, if needed, rather than in the main flow or automatic hover tooltips.
- Keep thumbnails at 44 × 44 px, without an enclosing card or a second line of metadata. Multiple references share one horizontally scrollable row, including on mobile; do not grow a grid that pushes the writing field away.
- Clicking a reference inserts a mention at the saved text selection. The preview illustrates `@Image1`, `@Audio1`, `@StartImage` and `@EndImage`; these are **application aliases, not a universal provider syntax**. Real integration must resolve asset identity and role, then translate to the selected model's supported bindings. Existing provider-specific mention checks remain authoritative.
- Preserve reference identity: deleting Image 1 does not rename Image 2, and a new attachment becomes Image 3. A removed or replaced reference mentioned in text requires review; never silently retarget a mention. Stable UI numbering may differ from compact provider indices, so the adapter must keep an explicit mapping.
- For a spoken audio script, clicking a reference switches to With Milo and inserts it into the message. Never insert a reference alias into words that TTS will read aloud. A future direction field can accept reference mentions if its actual contract supports them.
- **Conversation above, composer below.** Milo's messages are displayed in a bounded conversation area without an outer card. A separate, clearly outlined input surface below has the persistent visible label **Message Milo** and an action-specific placeholder. The message field does not scroll away with the conversation.
- **Suggested prompt** is a compact disclosure in the conversation. Expanding it reveals editable proposed text and Apply. It does not replace or visually resemble the reply input. Sending a follow-up returns focus to Message Milo. It does not generate media.
- Remove the old left focus bars, padding shifts, layered shadows and segmented-tab boxes. Use thin text tabs, one input border and restrained hover states. Clicking the prompt does not create an overlay. Keep a clear keyboard-only focus outline.
- The plus is a simple unframed glyph with a 44 px hit area. Main controls retain comfortable targets; compact reference-removal controls are 27 × 44 px, above the 24 px minimum and separate from the insert button.

The revised structure draws from assistant-ui's separate transcript and composer footer, Runway's typed reference labels, and Krea's distinction between start/end frames and generation settings. Exact sources and limits are recorded in the guidelines. This is still an isolated design prototype; production code, billing and provider adapters are unchanged.

## Intention et décisions acquises

Réduire la difficulté de partir d'un champ vide, tout en conservant un générateur direct pour les personnes qui savent écrire leur prompt ou utilisent leur propre LLM. Proposer une conversation avec Milo à l'intérieur de la zone de préparation du média. Adapter les conseils au moteur et au mode sélectionnés, plutôt que donner une aide générique.

Adrien a retenu ce périmètre, distinct de Studio, demandé une branche depuis `main` à jour, une interface plus fine et familière aux utilisateurs de LLM, et confirmé le réemploi des modèles et crédits Milo existants. Terra sera évalué séparément : aucun nouveau tarif ni modèle d'assistance dans cette branche.

La réussite attendue : une personne trouve l'ajout de références, comprend où écrire, distingue l'envoi d'un message de la génération payante et conserve le contrôle sur le résultat proposé. La qualité créative de Milo devra être évaluée ; une interface réussie ne la démontre pas.

## Approches

1. Améliorateur ponctuel : bouton qui réécrit le prompt. Simple, mais ne clarifie pas les intentions ambiguës et ne traite pas bien les références/réglages.
2. Conversation facultative dans le compositeur : **option retenue par Adrien**. Milo accompagne un média en préparation, avec suggestions applicables et retour au manuel.
3. Agent qui pilote un projet et plusieurs médias : relève de Studio, à garder séparé.

Pour la réalisation, conserver React, le SDK OpenAI Responses existant et les propriétaires actuels du brouillon, des références, du devis et de la génération. Ne pas ajouter de framework d'agents ou de bibliothèque globale d'état. Les composants publics étudiés fournissent des idées de composition, pas un remplacement prêt à brancher.

## Interface proposée

Le même emplacement propose deux onglets **Prompt** et **With Milo**. Le mode initial reste Prompt. Le passage d'un onglet à l'autre conserve le texte, les références et les réglages ; la préférence d'ouverture pourra être mémorisée par compte, sans mémoriser de contenu sensible dans une préférence globale.

Une surface de saisie unique, légèrement arrondie, remplace l'empilement des cartes de références. En mode Milo, la conversation se trouve au-dessus, hors de cette surface. Conserver les couleurs de MaxVideoAI, avec une bordure moins contrastée, une ombre très discrète et davantage d'espace intérieur. La profondeur doit venir de l'espacement et de la hiérarchie, pas de bordures imbriquées.

Ordre visuel :

1. Moteur et mode de génération, dans leurs contrôles existants.
2. Onglets Prompt / With Milo.
3. Texte manuel, ou conversation et proposition éditable.
4. Pièces jointes visibles, avec leur rôle, leur état et leur suppression.
5. Barre de saisie avec **+ à gauche** ; en mode Milo, bouton d'envoi de message à droite.
6. Réglages de génération compacts et bouton Générer avec le devis actuel.

Le bouton Générer conserve un libellé explicite et le prix calculé. L'envoi à Milo utilise une flèche avec un nom accessible « Envoyer à Milo ». Entrée envoie dans la conversation, Maj+Entrée ajoute une ligne ; la composition IME ne déclenche jamais d'envoi. Dans le prompt manuel et dans la proposition, Entrée reste un retour à la ligne. Aucun raccourci n'engage de génération payante.

Le menu + propose seulement les rôles disponibles : première/dernière image, références image/vidéo/audio, source à modifier ou prolonger, bibliothèque et sujets lorsqu'ils sont compatibles. Les intitulés et limites viennent des capacités existantes. Il réutilise l'inventaire, les importateurs, les extraits et les modales actuels. Ne pas transformer tous les médias en pièces jointes génériques.

**Une source obligatoire ne disparaît pas dans le menu +.** Son absence reste un bouton ou une indication visible au-dessus de la saisie, avec un accès direct au bon importateur. Une référence indisponible reste consultable/supprimable, et son incompatibilité est expliquée. Les états de chargement, erreur, limite atteinte, extrait et mentions restent accessibles.

Les réglages usuels restent visibles sous le compositeur. Les réglages avancés gardent leur propriétaire actuel. L'ajout de Milo n'autorise pas la disparition d'un réglage, de Storyboard, de Draft ou d'un workflow de modification/prolongation.

## Conversation et application

Milo reçoit l'intention écrite, le prompt courant, le modèle, le mode, les paramètres valides et les métadonnées des références. Il pose une question seulement lorsqu'une décision importante manque. Un brief suffisamment précis produit directement une proposition. Les suggestions de démarrage remplissent la saisie ; elles ne consomment pas de crédits avant Envoi.

La réponse comporte un message bref et, si utile, une proposition explicite : prompt, champ ciblé et modifications de réglages. Chaque changement de réglage affiche avant/après. Le moteur n'est jamais changé automatiquement. Si le besoin est incompatible, Milo explique la contrainte et invite à choisir un autre mode/moteur ; il ne prétend pas avoir changé la sélection.

**Appliquer** constitue une seule action pour le prompt et les réglages sélectionnés. Le texte proposé reste éditable avant application. **Annuler l'application** restaure le dernier instantané seulement si le brouillon n'a pas changé depuis ; sinon l'interface permet de relire/copier l'ancienne version sans écraser la nouvelle. Un bouton Copier reste disponible pour une proposition périmée.

Toute requête porte une identité de contexte et une révision monotone du brouillon. La révision change sur prompt, script, paramètres, références, mode et moteur. Une réponse tardive reste lisible mais ne s'applique pas si cette révision ou ce contexte ont changé, même si le texte est redevenu identique. Une nouvelle demande repart du brouillon courant.

Milo ne lance ni génération, ni devis fictif, ni modification de paramètres à la réception d'une réponse. Après application, les propriétaires actuels normalisent le brouillon et recalculent le devis ; Générer reste indisponible tant que le devis n'est pas valide.

## Particularités des trois surfaces

| Surface | Contrat |
| --- | --- |
| Vidéo | Respecter Create/Modify/Extend/Reframe, première/dernière image, sources, références, sujets, extraits et mentions. Storyboard reste un éditeur distinct ; une proposition multi-plan cible ses scènes structurées, jamais une simple chaîne qui les écrase. |
| Image | Réutiliser le Composer partagé, les contrôles du modèle et les références image. Même garde de révision et application explicite. |
| Audio | Conserver la séparation script prononcé / paroles / direction. La proposition nomme le champ qu'elle modifie. Ne pas injecter des indications entre crochets dans un script TTS ni réécrire des paroles sans demande. Les voix et sources ne changent pas implicitement. |

V1 doit offrir l'aide textuelle sur les trois surfaces. L'analyse perceptuelle de références vidéo/audio n'est pas incluse : Milo peut connaître leur rôle et leurs métadonnées, mais ne prétend pas les avoir vues/écoutées. Une analyse d'image n'est pas activée par simple présence d'une miniature ; son éventuel ajout nécessite la validation de propriété, l'usage du média autorisé et le comptage des entrées visuelles. Le texte d'interface distingue clairement « référence jointe » d'« analysée ».

## Contrat serveur et propriété

Créer un service de préparation de prompt indépendant de l'orchestrateur de Studio, avec une route dédiée au workspace. Le serveur authentifie le compte, impose même origine pour les mutations, borne le corps et la conversation, vérifie les médias du compte et résout lui-même modèle, mode, capacités et guide. Aucune capacité envoyée par le navigateur ne fait autorité.

Contrat conceptuel d'une demande : `sessionId`, `requestId`, `draftRevision`, `surface`, `engineId`, `mode`, `target`, `draft`, `message`. Les identifiants de session et de requête sont bornés et associés au compte. Le serveur conserve son historique court et une empreinte du corps pour rejouer une requête identique ; la réutilisation du même requestId avec un autre corps est refusée.

Réponse : identités de session/requête/contexte, message, éventuelle proposition validée et statut d'assistance. Les limites exactes de taille et de sortie seront fixées dans le plan à partir des budgets existants et de cas réels. Une entrée trop longue doit produire une erreur explicite avant débit ; aucune troncature silencieuse du prompt. Le contrat accepte les cibles prompt/script/lyrics/scenes et ne mélange pas leurs schémas.

Une requête Responses sans outils de génération suffit à une réponse ordinaire. Pas de boucle ouverte, pas de recherche web à chaque message, pas de chargement intégral des guides ou du projet Studio. Désactiver les reprises automatiques de requêtes facturables et utiliser les mêmes mécanismes de réservation/règlement que Milo.

## Crédits et reprises

Réutiliser les choix Sol/Luna, quotas, crédits achetés, choix d'épuisement et tarifs existants. Les coûts de discussion et de génération média restent distincts. Aucun nouveau portefeuille, forfait, tarif Terra ou crédit gratuit implicite. Le changement de préférence Milo est global comme aujourd'hui : son effet doit être indiqué, pas dissimulé comme un réglage local.

Le ledger d'assistance actuel utilise un `project_id` texte ; cela ne dispense pas d'un véritable propriétaire de session. Généraliser au besoin son interface de contexte à un scope d'assistance autorisé. Ne pas fabriquer un `StudioGenerationActor`, créer un projet Studio invisible ou exposer des fonctions Studio en contournant leur contrôle de propriété.

Une session de préparation et ses demandes ont une persistance dédiée, une propriété de compte et une expiration définies dans le plan. Ordre : réserver → enregistrer l'intention d'appel → appeler le fournisseur une fois → persister réponse et usage → régler de façon idempotente → exposer la réponse. En cas d'issue inconnue, bloquer le nouvel appel correspondant et permettre la réconciliation ; ni renvoi automatique facturé, ni faux succès gratuit. Audit préalable des scripts de récupération qui supposent actuellement un projet Studio.

Quitter l'onglet ou arrêter l'attente ne promet pas une annulation fournisseur ni un remboursement. Un changement de compte vide les références de session client et interrompt l'affichage de la réponse. Le serveur recontrôle toujours la propriété. Les contenus de conversation ne sont pas des instructions système et ne peuvent autoriser des appels ou changer les budgets.

## Fiches spécialisées

Charger une fiche par moteur et mode. Les schémas du produit fixent ce qui est disponible ; les fiches expliquent comment le formuler. Une fiche comporte version, date de relecture, sources, conventions de prompt, rôle des références, exemple approprié et erreurs connues. La couverture absente utilise une aide fondée sur les capacités, sans prétendre à une expertise documentée.

Le registre `agent-model-prompting-sources.json` contient des liens, pas les guides eux-mêmes. Réutiliser le contenu relu des pages de modèles et les sources officielles pertinentes ; ne pas demander au modèle de deviner ces pages à partir de leurs URL. Préserver les détails créatifs, le mouvement, les raccords et le son utiles. Aucune longueur arbitraire de prompt imposée par une recette externe.

## Propriétaires dans le code

- `frontend/components/Composer.tsx` : intégration légère, sous la limite contractuelle de 500 lignes.
- `frontend/components/composer/` : onglets, panneau Milo, proposition et barre d'ajout ; composants partagés image/vidéo.
- `WorkspaceReferenceSection.client.tsx` et ses sous-composants : import, rôles, extraits, mentions, états et restauration du focus restent ici.
- `useWorkspaceComposerState.ts` : valeurs du brouillon ; `useWorkspaceEngineModeState.ts` : modes/moteurs.
- `WorkspaceComposerSurface.tsx` et `ImageWorkspaceComposerSurface.tsx` : adaptateurs vidéo/image. La route audio actuelle monte `AudioCreationWorkspace.tsx` et `AudioCreationEditor.tsx` pour voix, musique, chanson, effets et ambiance ; `audio-workspace-composer-surface.tsx` concerne le parcours distinct de bande-son vidéo (`intent=video`). Ne pas intégrer l'aide uniquement dans cet ancien compositeur.
- Nouveau domaine browser-safe `frontend/src/lib/prompt-assistance/` : contrat, révision et validation des propositions côté client ; aucun secret.
- Nouveau domaine `frontend/src/server/prompt-assistance/` : contexte fiable, guides, appels et persistance.
- Ledger et contrat Milo existants : extraire seulement les types réellement communs, préserver les consommateurs Studio.
- CSS scoped au compositeur : éviter une nouvelle couche de sélecteurs globaux qui contredisent les densités et devis existants.

## Réutilisation publique et guidelines

Voir [les guidelines et sources](../../design/prompt-composer/GUIDELINES.md). Les techniques retenues : champ + barre d'actions + pièces jointes, états explicites, guide ciblé, schéma avant appel, absence de boucle gratuite supposée. Aucun code concurrent ni asset propriétaire n'est copié dans cette maquette.

Les décisions d'apparence proposées par Codex sont réversibles : rayon 15 px pour la surface, contrôles tactiles de 44 px, couleurs olive/ivoire/ambre existantes, typographie système, ligne fine et ombre douce. Conserver un contour de focus visible, une hiérarchie de texte lisible, le contraste AA, le mode sombre, les langues EN/FR/ES et les préférences de mouvement réduit. Les dimensions finales doivent être vérifiées dans la vraie application.

## Vérification et livraison

1. Valider la direction sur le prototype, y compris petit écran, manuel/Milo et source obligatoire. La maquette utilise des capacités simplifiées et n'est pas une preuve de compatibilité du catalogue.
2. Intégrer l'apparence en conservant tous les comportements actuels ; passer les tests Composer, références, devis, extension/modification, image et audio avant d'ajouter les appels.
3. Ajouter le contrat de révision et les adaptateurs, avec tests de réponse tardive, changement de compte/modèle, IME, appliquer/annuler et erreurs.
4. Ajouter le service Milo et les guides ; fixtures sans appels payants, tests d'accès, schémas, absence d'auto-génération, idempotence et récupération sur PostgreSQL 17 jetable.
5. Rejouer les tests de facturation Studio, les contrats d'architecture, TypeScript, lint/exposition, i18n et `test:validate` pour toute modification de génération/persistance. Faire une revue clavier, lecteurs accessibles, mobile et sombre avec le CSS réel.
6. Les essais créatifs payants, une activation de schéma en environnement partagé et un déploiement restent des étapes explicites. Pas de fusion ni de déploiement dans cette préparation.

L'intégration se fait dans la même branche par lots révisables : compositeur, contrat/adaptateurs, service/crédits, puis QA. La branche conserve toute la portée ; une première étape purement visuelle ne constitue pas une livraison de l'assistant.

Le [plan du premier lot](../plans/2026-10-28-prompt-director-app-integration.md) précise l'intégration visuelle locale dans les vraies routes, avant le raccord des appels Milo. La PR reste en brouillon pendant ces lots ; sa description doit distinguer ce qui est implémenté de ce qui reste à faire.

## Hors périmètre et réserve Studio

Pas de montage, de timeline, d'agent autonome multi-médias, de refonte du catalogue, de nouveau choix LLM affiché aux débutants, ni de migration de framework. Studio garde sa conversation de projet. Les fiches spécialisées et le contrat générique d'assistance pourront être partagés ; les pistes Studio de l'étude sont conservées dans les guidelines, sans activer de boucle d'analyse ou de retake.

## Sources de travail

- Étude locale : `/Users/adrienmillot/Documents/ChatGPT/OUTREACH/sources/2026-10-28/prompt-director-study/README.md` et `CODE-ET-GITHUB.md`.
- Architecture actuelle : `AGENTS.md`, `docs/engineering/llm-working-guide.md`, instructions des workspaces vidéo et image.
- `docs/engineering/studio-assistance-economics.md`, `frontend/src/server/studio/assistance-ledger.ts`, `frontend/src/lib/studio/assistance-contract.ts`.
- Observation de l'application connectée du 28/10 : lecture du compositeur vidéo existant ; aucune modification de brouillon, génération ou dépense.
