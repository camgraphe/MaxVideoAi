/** Synthetic cases shared by offline boundary tests and separately authorized output evaluation. */
type IntentCase = {
  id:string;
  message:string;
  editor:string;
  activeSuggestion?:string;
  history:Array<{role:'user'|'assistant';content:string}>;
  outputExpectation:string;
};

export const promptAssistanceIntentCases:IntentCase[] = [
  {
    id:'independent-first-brief',
    message:'Create a stop-motion advert where a red teapot dances across a kitchen table.',
    editor:'A deep-sea diver finds a glowing shell inside a sunken ship.',
    history:[],
    outputExpectation:'Develop the teapot advert without importing the diver, shell or ship.',
  },
  {
    id:'underspecified-style-brief',
    message:'Je voudrais un sketch drôle filmé au téléphone pour les réseaux sociaux.',
    editor:'A deep-sea diver finds a glowing shell inside a sunken ship.',
    history:[],
    outputExpectation:'Ask one concise question in French: reuse the existing prompt or start a new idea. Briefly identifying its underwater topic is allowed in the question. Return text:null; do not silently reuse the scene or propose a fresh gag yet.',
  },
  {
    id:'clarified-new-idea',
    message:'Une nouvelle idée.',
    editor:'A deep-sea diver finds a glowing shell inside a sunken ship.',
    history:[
      {role:'user',content:'Je voudrais un sketch drôle filmé au téléphone pour les réseaux sociaux.'},
      {role:'assistant',content:JSON.stringify({reply:'Veux-tu partir du prompt déjà présent ou créer une nouvelle idée ?',text:null})},
    ],
    outputExpectation:'Offer a fresh humorous phone-video idea without the underwater subject and without repeating the reuse-or-new question.',
  },
  {
    id:'clarified-reuse-editor',
    message:'El que ya está.',
    editor:'A deep-sea diver finds a glowing shell inside a sunken ship.',
    history:[
      {role:'user',content:'Quiero un sketch divertido grabado con el teléfono para redes sociales.'},
      {role:'assistant',content:JSON.stringify({reply:'¿Quieres partir del prompt que ya está en el editor o crear una idea nueva?',text:null})},
    ],
    outputExpectation:'Develop the existing diver/shell/ship scene as a humorous phone-style sketch; honor the reuse answer without asking the same question again.',
  },
  {
    id:'independent-brief-with-active-suggestion',
    message:'Quiero un anuncio en stop motion de una tetera roja que baila sobre una mesa de cocina.',
    editor:'A deep-sea diver finds a glowing shell inside a sunken ship.',
    activeSuggestion:'A chef in a yellow apron drops an onion, catches it and bows to the camera.',
    history:[
      {role:'user',content:'A funny cooking clip with a chef and an onion.'},
      {role:'assistant',content:JSON.stringify({reply:'Here is a cooking gag.',text:'A chef in a yellow apron drops an onion, catches it and bows to the camera.'})},
    ],
    outputExpectation:'Develop the teapot advert independently of both the old underwater editor and the cooking proposal.',
  },
  {
    id:'explicit-editor-revision-with-active-suggestion',
    message:'Work on the text currently in my manual editor: make the underwater camera drift slower.',
    editor:'A deep-sea diver finds a glowing shell inside a sunken ship.',
    activeSuggestion:'A commuter in a red scarf waves from a train window.',
    history:[],
    outputExpectation:'Revise the diver scene in the manual editor, not the unrelated commuter proposal.',
  },
  {
    id:'active-suggestion-follow-up',
    message:'Remplace son écharpe rouge par une écharpe bleue.',
    editor:'A deep-sea diver finds a glowing shell inside a sunken ship.',
    activeSuggestion:'A commuter in a red scarf waves from a train window.',
    history:[
      {role:'user',content:'Une voyageuse salue depuis la fenêtre du train.'},
      {role:'assistant',content:JSON.stringify({reply:'Voici la scène.',text:'A commuter in a red scarf waves from a train window.'})},
    ],
    outputExpectation:'Revise the commuter proposal with a blue scarf, preserving the idea without importing the diver.',
  },
  {
    id:'natural-conversation-continuation',
    message:'A little slower at the end, please.',
    editor:'A deep-sea diver finds a glowing shell inside a sunken ship.',
    history:[
      {role:'user',content:'A chef catches a falling onion and takes an exaggerated bow.'},
      {role:'assistant',content:JSON.stringify({reply:'Let the bow be the final comic beat.',text:'A chef catches a falling onion and takes an exaggerated bow.'})},
    ],
    outputExpectation:'Slow the final bow from the same conversation; do not demand explicit revision wording or switch to the old underwater editor.',
  },
];
