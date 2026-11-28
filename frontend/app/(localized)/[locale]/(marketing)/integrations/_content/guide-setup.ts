import type { AppLocale } from '@/i18n/locales';

export type DirectHost = 'claude' | 'n8n' | 'openclaw';

export const directSetupLabels = {
  en: { title: 'How to connect', copyAddress: 'Copy server address', copyCommands: 'Copy commands', advanced: 'Configuration details and other connection options' },
  fr: { title: 'Comment se connecter', copyAddress: 'Copier l’adresse du serveur', copyCommands: 'Copier les commandes', advanced: 'Détails de configuration et autres options de connexion' },
  es: { title: 'Cómo conectarse', copyAddress: 'Copiar la dirección del servidor', copyCommands: 'Copiar los comandos', advanced: 'Detalles de configuración y otras opciones de conexión' },
};

export const directSetupSteps: Record<AppLocale, Record<DirectHost, [string, string][]>> = {
  en: {
    claude: [
      ['Add a custom connector', 'Open Customize → Connectors in Claude and add a custom connector named MaxVideoAI. A team workspace may need an administrator to add it.'],
      ['Enter the server address', 'Paste the MCP address below and sign in with the MaxVideoAI account that holds your media.'],
      ['Enable it in your chat', 'Select the connector in your conversation. Ask Claude which video models work with your reference image.'],
    ],
    openclaw: [
      ['Add the MaxVideoAI skill', 'Open the MaxVideoAI entry on ClawHub and follow its installation instructions for your agent.'],
      ['Connect the MCP server', 'For a personal agent, run the commands below and finish OAuth in your browser. A shared gateway needs a separate identity for each creator.'],
      ['Check the connected library', 'Ask your agent for your recent MaxVideoAI media. Check the account before preparing a new shot.'],
    ],
    n8n: [
      ['Import the template', 'Open the published workflow on n8n and import it into your self-hosted instance.'],
      ['Attach your credentials', 'Create a MaxVideoAI OAuth2 credential for the MCP endpoint below. Attach it to each MaxVideoAI MCP Client node.'],
      ['Run a brief to the approval step', 'Supply the model, budget and generation inputs described in the template. Inspect the prepared settings and quote ID at the Human Approval node.'],
    ],
  },
  fr: {
    claude: [
      ['Ajoutez un connecteur personnalisé', 'Ouvrez Personnaliser → Connecteurs dans Claude et créez un connecteur nommé MaxVideoAI. Un espace d’équipe peut demander l’intervention d’un administrateur.'],
      ['Saisissez l’adresse du serveur', 'Collez l’adresse MCP ci-dessous, puis connectez le compte MaxVideoAI qui contient vos médias.'],
      ['Activez-le dans la conversation', 'Sélectionnez le connecteur dans votre conversation. Demandez à Claude quels modèles vidéo acceptent votre image de référence.'],
    ],
    openclaw: [
      ['Ajoutez le skill MaxVideoAI', 'Ouvrez la fiche MaxVideoAI sur ClawHub et suivez les instructions d’installation pour votre agent.'],
      ['Connectez le serveur MCP', 'Pour un agent personnel, lancez les commandes ci-dessous et autorisez la connexion dans votre navigateur. Une passerelle partagée nécessite une identité par créateur.'],
      ['Vérifiez la bibliothèque connectée', 'Demandez à votre agent de retrouver vos derniers médias MaxVideoAI. Vérifiez le compte avant de préparer un nouveau plan.'],
    ],
    n8n: [
      ['Importez le modèle de workflow', 'Ouvrez le workflow publié sur n8n et importez-le dans votre instance auto-hébergée.'],
      ['Associez vos identifiants', 'Créez un identifiant OAuth2 MaxVideoAI pour l’adresse MCP ci-dessous. Associez-le à chaque nœud MCP Client MaxVideoAI.'],
      ['Avancez jusqu’à la validation', 'Renseignez le modèle, le budget et les paramètres indiqués dans le workflow. Vérifiez les réglages et l’identifiant du devis dans le nœud Human Approval.'],
    ],
  },
  es: {
    claude: [
      ['Añade un conector personalizado', 'Abre Personalizar → Conectores en Claude y crea un conector llamado MaxVideoAI. En un equipo puede ser necesaria la ayuda de un administrador.'],
      ['Introduce la dirección del servidor', 'Pega la dirección MCP que aparece abajo e inicia sesión con la cuenta de MaxVideoAI que contiene tus medios.'],
      ['Actívalo en la conversación', 'Selecciona el conector en tu conversación. Pregunta a Claude qué modelos de vídeo admiten tu imagen de referencia.'],
    ],
    openclaw: [
      ['Añade el skill de MaxVideoAI', 'Abre la ficha de MaxVideoAI en ClawHub y sigue las instrucciones de instalación para tu agente.'],
      ['Conecta el servidor MCP', 'Para un agente personal, ejecuta los comandos de abajo y autoriza la conexión en el navegador. Una pasarela compartida necesita una identidad por creador.'],
      ['Comprueba la biblioteca conectada', 'Pide al agente tus últimos medios de MaxVideoAI. Comprueba la cuenta antes de preparar otro plano.'],
    ],
    n8n: [
      ['Importa la plantilla', 'Abre el flujo publicado en n8n e impórtalo en tu instancia autoalojada.'],
      ['Vincula tus credenciales', 'Crea una credencial OAuth2 de MaxVideoAI para la dirección MCP de abajo. Asígnala a cada nodo MCP Client de MaxVideoAI.'],
      ['Llega al paso de aprobación', 'Introduce el modelo, el presupuesto y los parámetros indicados en la plantilla. Comprueba los ajustes y el identificador de la cotización en el nodo Human Approval.'],
    ],
  },
};
